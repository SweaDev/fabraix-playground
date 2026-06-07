"""Platform — the injection boundary between the playground engine and its host.

The engine (agent, tools, API router) depends ONLY on this module. It reaches
the outside world through six seams the host supplies when it constructs the
`Platform`:

  - Store          — persistence (sessions / messages / stats / leaderboard / inbox)
  - GuardrailJudge — the external defence layer (the "two-layer defence")
  - Notifier       — out-of-band win notifications
  - Llm            — provider-agnostic completion
  - Browser        — the browse_web execution backend
  - Settings       — config + per-challenge secrets

The engine never imports anything host-specific, which keeps it portable and
self-contained. The bundled open-source implementation of every seam lives in
`adapters/oss.py` (SQLite store, an LLM-as-judge guardrail driven by the
contributor's own key, env-var settings, a no-op notifier, and a browser-use
browser).
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable

from pydantic import BaseModel, ConfigDict


# ---------------------------------------------------------------------------
# Store — persistence
# ---------------------------------------------------------------------------
@runtime_checkable
class Store(Protocol):
    """Persistence for sessions / messages / stats / leaderboard / inbox.

    Methods return plain dicts (column-name -> value) so the engine stays
    ORM-agnostic. The bundled implementation backs onto a local SQLite file.
    """

    # sessions
    async def create_session(
        self,
        *,
        guardrails_run_id: str,
        challenge_slug: str,
        user_identifier: str,
        agent_model: str,
        guardrails_model: str | None,
        browser_model: str | None,
    ) -> dict[str, Any]: ...
    async def get_session(self, session_id: str) -> dict[str, Any] | None: ...
    async def mark_session_solved(self, session_id: str) -> None: ...  # sets success=true, solved_at=now
    async def mark_session_ended(self, session_id: str) -> None: ...   # sets ended_at=now
    async def touch_session(self, session_id: str) -> None: ...        # message_count += 1, last_message_at=now

    # messages
    async def add_message(
        self, *, session_id: str, role: str, content: str, tools: list[dict] | None
    ) -> dict[str, Any]: ...
    async def get_messages(self, session_id: str) -> list[dict[str, Any]]: ...  # ordered by created_at

    # stats
    async def get_stats(self, challenge_slug: str) -> dict[str, Any] | None: ...
    async def list_stats(self) -> list[dict[str, Any]]: ...
    async def upsert_stats(self, challenge_slug: str, values: dict[str, Any]) -> None: ...
    async def increment_total_attempts(self, challenge_slug: str) -> None: ...  # atomic +1, creating the row at 1

    # leaderboard
    async def get_leaderboard(self, challenge_slug: str) -> list[dict[str, Any]]: ...  # ordered by time_seconds
    async def get_leaderboard_entry(self, session_id: str) -> dict[str, Any] | None: ...
    async def add_leaderboard_entry(
        self, *, session_id: str, challenge_slug: str, username: str, time_seconds: int
    ) -> dict[str, Any]: ...

    # inbox (data-exfil challenge)
    async def add_email(
        self, *, from_address: str, subject: str, body: str, label: str
    ) -> dict[str, Any]: ...
    async def read_inbox(self, label: str) -> list[dict[str, Any]]: ...


# ---------------------------------------------------------------------------
# GuardrailJudge — the external defence layer (the "two-layer defence")
# ---------------------------------------------------------------------------
class GuardrailDecision(BaseModel):
    blocked: bool
    risk_score: float
    reasoning: str


@runtime_checkable
class GuardrailJudge(Protocol):
    """Decides whether an agent action (tool call) is allowed.

    The bundled implementation is an LLM-as-judge driven by
    `Settings.guardrails_model` + the contributor's key; when
    `Settings.guardrails_enabled` is false a no-op pass-through is used.
    """

    async def check_action(
        self, *, session_id: str, trace_id: str, tool_name: str, tool_args: dict, context: dict
    ) -> GuardrailDecision: ...
    async def log_event(self, *, trace_id: str, event: str, data: dict) -> None: ...


# ---------------------------------------------------------------------------
# Notifier — out-of-band notifications (bundled: no-op)
# ---------------------------------------------------------------------------
@runtime_checkable
class Notifier(Protocol):
    async def notify_win(self, *, challenge_slug: str, username: str, time_seconds: int) -> None: ...


# ---------------------------------------------------------------------------
# Llm — provider-agnostic completion (litellm); models are configurable
# ---------------------------------------------------------------------------
class LlmResult(BaseModel):
    content: str
    tool_calls: list[dict]
    input_tokens: int
    output_tokens: int


@runtime_checkable
class Llm(Protocol):
    """One completion call. `model` is resolved per role from Settings so the
    same Llm drives the defender agent, the guardrail judge, etc."""

    async def complete(
        self, *, model: str, system: str, messages: list[dict], tools: list[dict] | None
    ) -> LlmResult: ...


# ---------------------------------------------------------------------------
# Browser — the browse_web execution backend (browser automation)
# ---------------------------------------------------------------------------
@runtime_checkable
class Browser(Protocol):
    """Runs a natural-language browser-automation task, returning its result text.

    The bundled implementation drives the browser-use cloud SDK with the
    contributor's `BROWSER_USE_API_KEY`, gated by `Settings.browser_agent_enabled`.
    A disabled (or misconfigured) browser returns a clear, non-raising message so
    a model that calls `browse_web` degrades gracefully instead of erroring the turn.
    """

    async def run(self, *, task: str, return_type: str) -> str: ...


# ---------------------------------------------------------------------------
# Settings — config/secrets (bundled: env vars)
# ---------------------------------------------------------------------------
@runtime_checkable
class Settings(Protocol):
    # secrets per challenge
    def secret_for(self, challenge_slug: str) -> str: ...  # e.g. ACCESS_CODE / INBOX_SECRET
    # which model powers each part (recorded onto the session)
    @property
    def agent_model(self) -> str: ...
    @property
    def guardrails_enabled(self) -> bool: ...
    @property
    def guardrails_model(self) -> str | None: ...
    @property
    def browser_model(self) -> str | None: ...
    # whether the browse_web tool runs a real browser (vs. a disabled no-op)
    @property
    def browser_agent_enabled(self) -> bool: ...
    # api keys are read by the Llm/browser impls directly from the environment


# ---------------------------------------------------------------------------
# Platform — the bundle the engine is constructed with
# ---------------------------------------------------------------------------
class Platform(BaseModel):
    # The seams are injected concrete objects, not validated data shapes.
    model_config = ConfigDict(arbitrary_types_allowed=True)

    store: Store
    guardrail: GuardrailJudge
    notifier: Notifier
    llm: Llm
    settings: Settings
    browser: Browser
