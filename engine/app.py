"""Playground API router.

`create_router(platform)` returns an `APIRouter` mounting all the
`/v1/playground/*` routes. Everything the routes need is reached through the
injected `Platform`:

  - persistence       -> `platform.store`
  - per-challenge secret / model config -> `platform.settings`
  - guardrail check + logging -> `platform.guardrail` (the agent calls it)
  - win notification   -> `platform.notifier` (the leaderboard tool fires it)

Behaviour notes:
  - A local `guardrails_run_id` is generated per session/restart.
  - The "session ended" gate reads `ended_at`.
  - Solve duration is `solved_at - created_at` (stamped by
    `store.mark_session_solved`).

Depends only on its injected `Platform` and sibling modules; it never reaches
into the host application.
"""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from .agent import PlaygroundAgent
from .challenges import get_active_challenges, get_challenge
from .adapters.base import Platform
from .schemas import (
    PlaygroundChatRequest,
    PlaygroundStartSessionRequest,
    SSEEvent,
    SSEEventType,
)
from .timeutil import solve_duration_seconds
from .win import LEADERBOARD_SYSTEM_PROMPT

logger = structlog.get_logger()


def format_ndjson(event: SSEEvent) -> str:
    """Format an event as NDJSON (Newline Delimited JSON).

    Each line is a complete JSON object with event type and data.
    """
    data = dict(event.data)
    if event.status_message is not None:
        data["status_message"] = event.status_message

    output = {
        "event": event.event.value,
        "data": data,
        "timestamp": event.timestamp,
    }
    return json.dumps(output) + "\n"


def create_router(platform: Platform) -> APIRouter:
    """Build the `/v1/playground` router wired to the given `Platform`."""

    router = APIRouter(prefix="/v1/playground", tags=["Playground"])
    agent = PlaygroundAgent(platform)
    store = platform.store
    settings = platform.settings

    async def _recalculate_success_rate(challenge_slug: str) -> None:
        """Recalculate success_rate after total_attempts changes (start/restart)."""
        current = await store.get_stats(challenge_slug)
        if not current:
            return
        total = current.get("total_attempts", 1)
        successful = current.get("successful_attempts", 0)
        success_rate = (successful / total * 100) if total > 0 else 0
        await store.upsert_stats(challenge_slug, {"success_rate": success_rate})

    async def _increment_total_attempts(challenge_slug: str) -> None:
        """Atomically bump total_attempts (creating the stats row if needed)."""
        await store.increment_total_attempts(challenge_slug)

    async def _record_win(session: dict) -> None:
        """Mark the session solved and update the per-challenge stats cache.

        Solve duration is `solved_at - created_at` (stamped by
        `store.mark_session_solved`). The session is NOT ended here — the
        leaderboard tool ends it once a name is recorded.
        """
        session_id = session["id"]
        slug = session["challenge_slug"]

        await store.mark_session_solved(session_id)

        # Refetch to read the just-stamped solved_at for the duration.
        solved = await store.get_session(session_id) or session
        duration = solve_duration_seconds(solved)

        current_stats = await store.get_stats(slug) or {}

        new_best_time = current_stats.get("best_time_seconds")
        if new_best_time is None or duration < new_best_time:
            new_best_time = duration

        successful_attempts = current_stats.get("successful_attempts", 0) + 1
        total_attempts = current_stats.get("total_attempts", 1)
        success_rate = (successful_attempts / total_attempts * 100) if total_attempts > 0 else 0

        await store.upsert_stats(
            slug,
            {
                "total_attempts": total_attempts,
                "successful_attempts": successful_attempts,
                "best_time_seconds": new_best_time,
                "success_rate": success_rate,
                # Pass a datetime object, not an ISO string: the SQLite DateTime
                # type only binds Python datetime/date (Postgres tolerates ISO
                # strings, SQLite raises). The store renders it back to ISO.
                "last_success_at": datetime.now(timezone.utc),
            },
        )

    # ----------------------------------------------------------------- stats
    @router.get("/stats", name="playground_stats", status_code=200)
    async def get_stats(
        challenge_slug: str | None = Query(None, description="Filter stats by challenge slug"),
    ) -> JSONResponse:
        """Get playground statistics, optionally filtered by challenge."""
        try:
            if challenge_slug:
                row = await store.get_stats(challenge_slug)
                stats = [row] if row else []
            else:
                stats = await store.list_stats()

            total_attempts = sum(s.get("total_attempts", 0) for s in stats)
            successful = sum(s.get("successful_attempts", 0) for s in stats)

            success_rate = (successful / total_attempts * 100) if total_attempts > 0 else 0

            # Find best time across all challenges
            best_times = [
                s.get("best_time_seconds")
                for s in stats
                if s.get("best_time_seconds") is not None
            ]
            best_time = min(best_times) if best_times else None

            return JSONResponse(
                status_code=200,
                content={
                    "totalAttempts": f"{total_attempts:,}",
                    "successRate": f"{success_rate:.1f}%",
                    "bestTime": f"{best_time // 60}:{best_time % 60:02d}" if best_time else "N/A",
                },
            )
        except Exception as e:
            logger.error("playground.stats.error", error=str(e), exc_info=True)
            return JSONResponse(
                status_code=200,
                content={
                    "totalAttempts": "0",
                    "successRate": "0%",
                    "bestTime": "N/A",
                },
            )

    # ------------------------------------------------------------- challenges
    @router.get("/challenges", name="playground_challenges_list", status_code=200)
    async def get_challenges_list() -> JSONResponse:
        """Get list of available challenges with per-challenge stats."""
        try:
            challenges = get_active_challenges()

            all_stats = await store.list_stats()
            stats_by_slug = {s["challenge_slug"]: s for s in all_stats}

            challenge_list = []
            for c in challenges:
                # Check if deadline has passed
                locked = False

                challenge_stats = stats_by_slug.get(c.slug)
                total_attempts = challenge_stats.get("total_attempts", 0) if challenge_stats else 0
                success_rate = challenge_stats.get("success_rate", 0) if challenge_stats else 0
                best_time = challenge_stats.get("best_time_seconds") if challenge_stats else None

                challenge_list.append({
                    "id": c.slug,
                    "name": c.name,
                    "difficulty": c.difficulty,
                    "locked": locked,
                    "stats": {
                        "totalAttempts": f"{total_attempts:,}",
                        "successRate": f"{success_rate:.1f}%",
                        "bestTime": f"{best_time // 60}:{best_time % 60:02d}" if best_time else "N/A",
                    },
                })

            return JSONResponse(status_code=200, content=challenge_list)
        except Exception as e:
            logger.error("playground.challenges.error", error=str(e), exc_info=True)
            raise HTTPException(status_code=500, detail="Failed to fetch challenges")

    @router.get("/challenges/{challenge_slug}", name="playground_challenge_detail", status_code=200)
    async def get_challenge_detail(challenge_slug: str) -> JSONResponse:
        """Get detailed challenge configuration."""
        try:
            challenge = get_challenge(challenge_slug)

            if not challenge:
                raise HTTPException(
                    status_code=404,
                    detail=f"Challenge '{challenge_slug}' not found",
                )

            challenge_stats = await store.get_stats(challenge_slug)

            return JSONResponse(
                status_code=200,
                content={
                    "id": challenge.slug,
                    "name": challenge.name,
                    "difficulty": challenge.difficulty,
                    "description": challenge.description,
                    "objective": challenge.objective,
                    "agentPersona": challenge.agent_persona,
                    "agentSubtitle": challenge.agent_subtitle,
                    "systemPrompt": challenge.system_prompt,
                    "greeting": challenge.greeting,
                    "deadline": challenge.deadline.isoformat() if challenge.deadline else None,
                    "stats": {
                        "totalAttempts": challenge_stats["total_attempts"] if challenge_stats else 0,
                        "successRate": f"{challenge_stats.get('success_rate', 0):.1f}%" if challenge_stats else "0%",
                    } if challenge_stats else None,
                },
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "playground.challenge_detail.error",
                challenge_slug=challenge_slug,
                error=str(e),
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail="Failed to fetch challenge")

    # ---------------------------------------------------------------- sessions
    @router.post("/sessions/start", name="playground_start_session", status_code=201)
    async def start_session(request: PlaygroundStartSessionRequest) -> JSONResponse:
        """Start a new playground session."""
        try:
            challenge = get_challenge(request.challenge_id)

            if not challenge:
                raise HTTPException(
                    status_code=404,
                    detail=f"Challenge '{request.challenge_id}' not found",
                )

            # No external register-agent-run; generate a local guardrails run id.
            guardrails_run_id = f"gr-{uuid.uuid4().hex}"

            session = await store.create_session(
                guardrails_run_id=guardrails_run_id,
                challenge_slug=challenge.slug,
                user_identifier=request.user_identifier or "pg-player-anonymous",
                agent_model=settings.agent_model,
                guardrails_model=settings.guardrails_model,
                browser_model=settings.browser_model,
            )

            # Update stats - increment total attempts and recalculate success rate
            await _increment_total_attempts(challenge.slug)
            await _recalculate_success_rate(challenge.slug)

            logger.info(
                "playground.session.started",
                session_id=session["id"],
                guardrails_run_id=guardrails_run_id,
                challenge=request.challenge_id,
            )

            return JSONResponse(
                status_code=201,
                content={
                    "sessionId": session["id"],
                    "guardrailsRunId": guardrails_run_id,
                    "challenge": {
                        "id": challenge.slug,
                        "name": challenge.name,
                        "agentPersona": challenge.agent_persona,
                        "agentSubtitle": challenge.agent_subtitle,
                    },
                    "greeting": challenge.greeting,
                },
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error("playground.start_session.error", error=str(e), exc_info=True)
            raise HTTPException(
                status_code=500,
                detail="Failed to start session. Please try again.",
            )

    # -------------------------------------------------------------------- chat
    @router.post("/chat", name="playground_chat", status_code=200)
    async def chat(request: PlaygroundChatRequest) -> JSONResponse:
        """Process a chat message in an active session."""
        try:
            session = await store.get_session(request.session_id)

            if not session:
                raise HTTPException(status_code=404, detail="Session not found")

            # Check if session is still active (ended gate reads ended_at)
            if session.get("ended_at"):
                raise HTTPException(status_code=400, detail="Session has ended")

            # Leaderboard mode: session already won, route to leaderboard agent
            if session.get("success"):
                await store.add_message(
                    session_id=request.session_id,
                    role="user",
                    content=request.message,
                    tools=None,
                    thinking=request.thinking,
                )

                result = await agent.chat(
                    trace_id=session["guardrails_run_id"],
                    system_prompt=LEADERBOARD_SYSTEM_PROMPT,
                    secret="",
                    tool_names=["submit_leaderboard"],
                    conversation_history=[],
                    user_message=request.message,
                    session_id=request.session_id,
                    check_for_secret=False,
                )

                await store.add_message(
                    session_id=request.session_id,
                    role="assistant",
                    content=result["content"],
                    tools=result["tool_calls"] or None,
                )

                logger.info("playground.chat.leaderboard", session_id=request.session_id)

                return JSONResponse(
                    status_code=200,
                    content={
                        "content": result["content"],
                        "toolCalls": result["tool_calls"],
                        "safe": True,
                        "reason": "Leaderboard submission",
                        "success": True,
                    },
                )

            # Get challenge from filesystem
            challenge = get_challenge(session["challenge_slug"])
            if not challenge:
                raise HTTPException(status_code=404, detail="Challenge not found")

            # Get conversation history (ordered by created_at)
            messages = await store.get_messages(request.session_id)
            conversation_history = [
                {"role": m["role"], "content": m["content"]}
                for m in messages
            ]

            # Save user message
            await store.add_message(
                session_id=request.session_id,
                role="user",
                content=request.message,
                tools=None,
                thinking=request.thinking,
            )

            # Resolve secret by challenge slug
            secret = settings.secret_for(challenge.slug)

            # Call playground agent
            result = await agent.chat(
                trace_id=session["guardrails_run_id"],
                system_prompt=challenge.system_prompt,
                secret=secret,
                tool_names=challenge.tools,
                conversation_history=conversation_history,
                user_message=request.message,
                session_id=request.session_id,
            )

            # Save assistant message
            await store.add_message(
                session_id=request.session_id,
                role="assistant",
                content=result["content"],
                tools=result["tool_calls"] or None,
            )

            # Update session message count
            await store.touch_session(request.session_id)

            # If successful extraction, mark solved + update stats (don't end —
            # the leaderboard tool ends the session).
            if result["success"]:
                await _record_win(session)

            logger.info(
                "playground.chat.complete",
                session_id=request.session_id,
                safe=result["safe"],
                success=result["success"],
            )

            return JSONResponse(
                status_code=200,
                content={
                    "content": result["content"],
                    "toolCalls": result["tool_calls"],
                    "safe": result["safe"],
                    "reason": result["reason"],
                    "success": result["success"],
                },
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "playground.chat.error",
                session_id=request.session_id,
                error=str(e),
                exc_info=True,
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to process message. Please try again.",
            )

    # ------------------------------------------------------------- chat/stream
    @router.post("/chat/stream", name="playground_chat_stream", status_code=200)
    async def chat_stream(request: PlaygroundChatRequest) -> StreamingResponse:
        """Process a chat message with SSE (NDJSON) streaming status updates."""
        session = await store.get_session(request.session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Check if session is still active (ended gate reads ended_at)
        if session.get("ended_at"):
            raise HTTPException(status_code=400, detail="Session has ended")

        # Leaderboard mode: session already won, route to leaderboard agent
        is_leaderboard_mode = bool(session.get("success"))

        challenge = None
        conversation_history: list[dict[str, str]] = []

        if is_leaderboard_mode:
            await store.add_message(
                session_id=request.session_id,
                role="user",
                content=request.message,
                tools=None,
                thinking=request.thinking,
            )
        else:
            challenge = get_challenge(session["challenge_slug"])
            if not challenge:
                raise HTTPException(status_code=404, detail="Challenge not found")

            messages = await store.get_messages(request.session_id)
            conversation_history = [
                {"role": m["role"], "content": m["content"]}
                for m in messages
            ]
            await store.add_message(
                session_id=request.session_id,
                role="user",
                content=request.message,
                tools=None,
                thinking=request.thinking,
            )

        async def event_generator():
            """Generate SSE events from the agent."""
            final_result = None

            try:
                if is_leaderboard_mode:
                    async for event in agent.chat_stream(
                        trace_id=session["guardrails_run_id"],
                        system_prompt=LEADERBOARD_SYSTEM_PROMPT,
                        secret="",
                        tool_names=["submit_leaderboard"],
                        conversation_history=[],
                        user_message=request.message,
                        session_id=request.session_id,
                        check_for_secret=False,
                    ):
                        yield format_ndjson(event)
                        if event.event == SSEEventType.COMPLETE:
                            final_result = event.data

                    if final_result:
                        await store.add_message(
                            session_id=request.session_id,
                            role="assistant",
                            content=final_result["content"],
                            tools=final_result.get("tool_calls") or None,
                        )

                    logger.info(
                        "playground.chat_stream.leaderboard",
                        session_id=request.session_id,
                    )
                else:
                    secret = settings.secret_for(challenge.slug)

                    async for event in agent.chat_stream(
                        trace_id=session["guardrails_run_id"],
                        system_prompt=challenge.system_prompt,
                        secret=secret,
                        tool_names=challenge.tools,
                        conversation_history=conversation_history,
                        user_message=request.message,
                        session_id=request.session_id,
                    ):
                        yield format_ndjson(event)

                        if event.event == SSEEventType.COMPLETE:
                            final_result = event.data

                    if final_result:
                        await store.add_message(
                            session_id=request.session_id,
                            role="assistant",
                            content=final_result["content"],
                            tools=final_result["tool_calls"] or None,
                        )

                        await store.touch_session(request.session_id)

                        if final_result.get("success"):
                            await _record_win(session)

                    logger.info(
                        "playground.chat_stream.complete",
                        session_id=request.session_id,
                        safe=final_result.get("safe") if final_result else None,
                        success=final_result.get("success") if final_result else None,
                    )

            except Exception as e:
                logger.error(
                    "playground.chat_stream.error",
                    session_id=request.session_id,
                    error=str(e),
                    exc_info=True,
                )
                error_event = SSEEvent(
                    event=SSEEventType.ERROR,
                    data={"message": "An error occurred processing your request"},
                )
                yield format_ndjson(error_event)

        return StreamingResponse(
            event_generator(),
            media_type="application/x-ndjson",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # ------------------------------------------------------------ restart
    @router.post("/sessions/{session_id}/restart", name="playground_restart_session", status_code=201)
    async def restart_session(session_id: str) -> JSONResponse:
        """Restart a session - creates a new session/trace."""
        try:
            old_session = await store.get_session(session_id)

            if not old_session:
                raise HTTPException(status_code=404, detail="Session not found")

            challenge = get_challenge(old_session["challenge_slug"])
            if not challenge:
                raise HTTPException(status_code=404, detail="Challenge not found")

            # End old session
            await store.mark_session_ended(session_id)

            # Create new session (local guardrails run id)
            guardrails_run_id = f"gr-{uuid.uuid4().hex}"

            new_session = await store.create_session(
                guardrails_run_id=guardrails_run_id,
                challenge_slug=challenge.slug,
                user_identifier=old_session.get("user_identifier") or "pg-player-anonymous",
                agent_model=settings.agent_model,
                guardrails_model=settings.guardrails_model,
                browser_model=settings.browser_model,
            )

            # Update stats - increment total attempts and recalculate success rate
            await _increment_total_attempts(challenge.slug)
            await _recalculate_success_rate(challenge.slug)

            logger.info(
                "playground.session.restarted",
                old_session_id=session_id,
                new_session_id=new_session["id"],
            )

            return JSONResponse(
                status_code=201,
                content={
                    "sessionId": new_session["id"],
                    "guardrailsRunId": guardrails_run_id,
                    "greeting": challenge.greeting,
                },
            )

        except HTTPException:
            raise
        except Exception as e:
            logger.error(
                "playground.restart_session.error",
                session_id=session_id,
                error=str(e),
                exc_info=True,
            )
            raise HTTPException(status_code=500, detail="Failed to restart session")

    # ------------------------------------------------------------- leaderboard
    @router.get("/leaderboard", name="playground_leaderboard", status_code=200)
    async def get_leaderboard(
        challenge_slug: str = Query(..., description="Challenge slug to get leaderboard for"),
    ) -> JSONResponse:
        """Get leaderboard entries for a challenge, ordered by best time."""
        try:
            entries = await store.get_leaderboard(challenge_slug)

            return JSONResponse(
                status_code=200,
                content=[
                    {
                        "username": e["username"],
                        "timeSeconds": e["time_seconds"],
                        "time": f"{e['time_seconds'] // 60}:{e['time_seconds'] % 60:02d}",
                        "createdAt": e["created_at"],
                    }
                    for e in entries
                ],
            )
        except Exception as e:
            logger.error("playground.leaderboard.error", error=str(e), exc_info=True)
            return JSONResponse(status_code=200, content=[])

    # -------------------------------------------------------------- guardrails
    @router.get("/guardrails", name="playground_guardrails", status_code=200)
    async def get_guardrails() -> JSONResponse:
        """Get list of active guardrails (for display purposes)."""
        return JSONResponse(
            status_code=200,
            content=[
                {"id": "injection", "name": "Prompt Injection Detection"},
                {"id": "jailbreak", "name": "Jailbreak Prevention"},
                {"id": "extraction", "name": "Data Extraction Block"},
                {"id": "roleplay", "name": "Role Manipulation Guard"},
                {"id": "tool_abuse", "name": "Tool Call Monitoring"},
            ],
        )

    return router
