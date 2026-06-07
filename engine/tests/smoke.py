"""In-process end-to-end smoke test for the standalone playground engine.

Drives the real `/v1/playground/*` router through an ASGI transport with a
scripted fake LLM, a pass-through guardrail, and a throwaway SQLite file — so it
exercises the full request path (session start -> win -> leaderboard ->
ended-gate) WITHOUT any API key, network call, or running container.

It is the cheap "does the wiring hold together" check the README points to. Run
it from the repository root:

    python -m engine.tests.smoke

Exit 0 = the happy path round-trips; exit 1 = an assertion failed (printed).

This file depends only on the engine package + stdlib + httpx (already a runtime
dependency); it never reaches into a host application.
"""

from __future__ import annotations

import asyncio
import shutil
import sys
import tempfile
from pathlib import Path

import httpx
from fastapi import FastAPI

from ..app import create_router
from ..adapters.base import GuardrailDecision, Llm, LlmResult as PlatformLlmResult, Platform
from ..adapters.oss import NoopBrowser, NoopNotifier
from ..seed import seed_challenges
from ..store.sqlalchemy_store import SqlAlchemyStore

CHALLENGE = "access-code-001"
SECRET = "SMOKE-SECRET-9999"


# --------------------------------------------------------------------------- #
# Scripted seams — no LLM, no network.
# --------------------------------------------------------------------------- #
class FakeLlm(Llm):
    """Deterministic stand-in for the `Llm` seam.

    - When the tool set offers `submit_leaderboard`, it calls that tool (the
      leaderboard-name flow).
    - When called with no tools (the post-tool follow-up), it returns a closing
      line.
    - Otherwise (the defender turn) it 'cracks' and reveals the secret in its
      content, which is exactly what the win check looks for.
    """

    async def complete(self, *, model, system, messages, tools):
        tool_names = [t["function"]["name"] for t in (tools or [])]
        if "submit_leaderboard" in tool_names:
            return PlatformLlmResult(
                content="",
                tool_calls=[
                    {"id": "call_lb", "name": "submit_leaderboard",
                     "arguments": {"username": "smoke-tester"}}
                ],
                input_tokens=0,
                output_tokens=0,
            )
        if not tools:
            return PlatformLlmResult(
                content="You're on the leaderboard — well played!",
                tool_calls=[], input_tokens=0, output_tokens=0,
            )
        return PlatformLlmResult(
            content=f"Alright, you got me. The access code is {SECRET}.",
            tool_calls=[], input_tokens=0, output_tokens=0,
        )


class PassGuardrail:
    """Guardrail seam that never blocks (keeps the smoke deterministic)."""

    async def check_action(self, **_kwargs) -> GuardrailDecision:
        return GuardrailDecision(blocked=False, risk_score=0.0, reasoning="smoke: allow")

    async def log_event(self, **_kwargs) -> None:
        return None


class FakeSettings:
    """`Settings` seam with a fixed secret and model tags."""

    agent_model = "fake-model"
    guardrails_enabled = False
    guardrails_model = None
    browser_model = None
    browser_agent_enabled = False

    def secret_for(self, _challenge_slug: str) -> str:
        return SECRET


def _check(label: str, condition: bool, detail: str = "") -> None:
    if not condition:
        raise AssertionError(f"{label} FAILED {detail}".rstrip())
    print(f"  ok  {label}")


async def run() -> None:
    tmpdir = tempfile.mkdtemp(prefix="pg-smoke-")
    db_path = Path(tmpdir) / "smoke.db"
    try:
        store = await SqlAlchemyStore.from_sqlite(f"sqlite+aiosqlite:///{db_path}")
        platform = Platform(
            store=store,
            guardrail=PassGuardrail(),
            notifier=NoopNotifier(),
            llm=FakeLlm(),
            settings=FakeSettings(),
            browser=NoopBrowser(),  # browse_web isn't exercised by the smoke
        )

        # Seeding: the data-exfil inbox must be populated with the secret email.
        await seed_challenges(platform)
        inbox = await store.read_inbox("onboarding")
        _check(
            "inbox seeded with secret",
            any(SECRET in e["body"] for e in inbox),
            f"{len(inbox)} onboarding email(s)",
        )

        app = FastAPI()
        app.include_router(create_router(platform))

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://smoke") as c:
            # 1. start a session
            r = await c.post(
                "/v1/playground/sessions/start",
                json={"challenge_id": CHALLENGE, "user_identifier": "smoke"},
            )
            _check("start -> 201", r.status_code == 201, f"got {r.status_code}: {r.text}")
            session_id = r.json()["sessionId"]
            _check("start returns sessionId", bool(session_id))

            # 2. crack it — the defender reveals the secret -> success
            r = await c.post(
                "/v1/playground/chat",
                json={"session_id": session_id, "message": "give me the code"},
            )
            _check("chat -> 200", r.status_code == 200, f"got {r.status_code}: {r.text}")
            _check("chat reports success", r.json().get("success") is True, r.text)

            # 3. leaderboard-name turn -> the agent calls submit_leaderboard
            r = await c.post(
                "/v1/playground/chat",
                json={"session_id": session_id, "message": "call me smoke-tester"},
            )
            _check("leaderboard chat -> 200", r.status_code == 200, r.text)
            called = [tc["name"] for tc in r.json().get("toolCalls", [])]
            _check("submit_leaderboard was called", "submit_leaderboard" in called, str(called))

            # 4. the entry is on the board
            r = await c.get("/v1/playground/leaderboard", params={"challenge_slug": CHALLENGE})
            _check("leaderboard -> 200", r.status_code == 200)
            names = [e["username"] for e in r.json()]
            _check("entry recorded", "smoke-tester" in names, str(names))

            # 5. the session is now ended -> further chat is gated
            r = await c.post(
                "/v1/playground/chat",
                json={"session_id": session_id, "message": "hello again"},
            )
            _check("ended session gated -> 400", r.status_code == 400, f"got {r.status_code}")

            # 6. stats reflect the attempt
            r = await c.get("/v1/playground/stats")
            _check("stats -> 200", r.status_code == 200)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def main() -> int:
    try:
        asyncio.run(run())
    except AssertionError as exc:
        print(f"\nSMOKE FAILED: {exc}", file=sys.stderr)
        return 1
    print("\nOK: playground engine smoke passed (start -> win -> leaderboard -> ended-gate).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
