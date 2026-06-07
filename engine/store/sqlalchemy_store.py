"""SQLite-backed Store implementation for the Fabraix Playground engine.

Returns plain dicts (column-name -> value, datetimes rendered as ISO 8601
strings) and backs onto a local SQLite file via aiosqlite. A couple of details
are SQLite-specific:

  - `upsert_stats` / `increment_total_attempts` use SQLite's native
    `INSERT ... ON CONFLICT DO UPDATE` (atomic upsert — no read-modify-write or
    check-then-insert race).
  - timestamp updates are stamped Python-side (`datetime.now(timezone.utc)`)
    rather than via `func.now()`, which SQLite renders as a naive string.

Depends only on `store.models` and stdlib/third-party packages; it never reaches
into a host application.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import structlog
from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import (
    async_sessionmaker,
    create_async_engine,
)

from .models import (
    Base,
    PlaygroundInbox,
    PlaygroundLeaderboard,
    PlaygroundMessage,
    PlaygroundSession,
    PlaygroundStats,
)

logger = structlog.get_logger()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime | None) -> str | None:
    return dt.isoformat() if dt is not None else None


def _to_dict(obj: Any) -> dict[str, Any]:
    """ORM instance -> dict (datetimes rendered ISO 8601)."""
    out: dict[str, Any] = {}
    for col in obj.__table__.columns:
        val = getattr(obj, col.name)
        out[col.name] = _iso(val) if isinstance(val, datetime) else val
    return out


class SqlAlchemyStore:
    """`Store` Protocol impl over `store.models` + an async sessionmaker."""

    def __init__(self, session_factory: async_sessionmaker) -> None:
        self._session_factory = session_factory

    @classmethod
    async def from_sqlite(cls, url: str) -> "SqlAlchemyStore":
        """Build an async engine + sessionmaker for a SQLite URL and create tables.

        `url` should be an aiosqlite URL, e.g. `sqlite+aiosqlite:///./playground.db`
        or `sqlite+aiosqlite://` for an in-memory DB.
        """
        engine = create_async_engine(url, future=True)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        return cls(session_factory)

    # ----------------------------------------------------------------- sessions
    async def create_session(
        self,
        *,
        guardrails_run_id: str,
        challenge_slug: str,
        user_identifier: str,
        agent_model: str,
        guardrails_model: str | None,
        browser_model: str | None,
    ) -> dict[str, Any]:
        async with self._session_factory() as session:
            row = PlaygroundSession(
                guardrails_run_id=guardrails_run_id,
                challenge_slug=challenge_slug,
                user_identifier=user_identifier,
                agent_model=agent_model,
                guardrails_model=guardrails_model,
                browser_model=browser_model,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_dict(row)

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        async with self._session_factory() as session:
            row = await session.get(PlaygroundSession, session_id)
            return _to_dict(row) if row else None

    async def mark_session_solved(self, session_id: str) -> None:
        """Set success=true and stamp solved_at (only on the first win)."""
        async with self._session_factory() as session:
            await session.execute(
                update(PlaygroundSession)
                .where(PlaygroundSession.id == session_id)
                .where(PlaygroundSession.solved_at.is_(None))
                .values(success=True, solved_at=_now())
            )
            await session.commit()

    async def mark_session_ended(self, session_id: str) -> None:
        async with self._session_factory() as session:
            await session.execute(
                update(PlaygroundSession)
                .where(PlaygroundSession.id == session_id)
                .values(ended_at=_now())
            )
            await session.commit()

    async def touch_session(self, session_id: str) -> None:
        """Bump message_count and last_message_at on each turn."""
        async with self._session_factory() as session:
            await session.execute(
                update(PlaygroundSession)
                .where(PlaygroundSession.id == session_id)
                .values(
                    message_count=PlaygroundSession.message_count + 1,
                    last_message_at=_now(),
                )
            )
            await session.commit()

    # ----------------------------------------------------------------- messages
    async def add_message(
        self, *, session_id: str, role: str, content: str, tools: list[dict] | None
    ) -> dict[str, Any]:
        async with self._session_factory() as session:
            row = PlaygroundMessage(
                session_id=session_id, role=role, content=content, tools=tools
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_dict(row)

    async def get_messages(self, session_id: str) -> list[dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PlaygroundMessage)
                .where(PlaygroundMessage.session_id == session_id)
                .order_by(PlaygroundMessage.created_at.asc())
            )
            return [_to_dict(r) for r in result.scalars().all()]

    # -------------------------------------------------------------------- stats
    async def get_stats(self, challenge_slug: str) -> dict[str, Any] | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PlaygroundStats).where(
                    PlaygroundStats.challenge_slug == challenge_slug
                )
            )
            row = result.scalar_one_or_none()
            return _to_dict(row) if row else None

    async def list_stats(self) -> list[dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(select(PlaygroundStats))
            return [_to_dict(r) for r in result.scalars().all()]

    async def upsert_stats(self, challenge_slug: str, values: dict[str, Any]) -> None:
        """Insert-or-update the per-challenge stats row (keyed by challenge_slug)"""
        async with self._session_factory() as session:
            insert_values = {"challenge_slug": challenge_slug, "updated_at": _now(), **values}
            stmt = sqlite_insert(PlaygroundStats).values(**insert_values)
            stmt = stmt.on_conflict_do_update(
                index_elements=[PlaygroundStats.challenge_slug],
                set_={**values, "updated_at": _now()},
            )
            await session.execute(stmt)
            await session.commit()

    async def increment_total_attempts(self, challenge_slug: str) -> None:
        """Atomically bump total_attempts by 1 (create the row at 1 if absent)"""
        async with self._session_factory() as session:
            stmt = sqlite_insert(PlaygroundStats).values(
                challenge_slug=challenge_slug, total_attempts=1, updated_at=_now()
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=[PlaygroundStats.challenge_slug],
                set_={
                    "total_attempts": PlaygroundStats.total_attempts + 1,
                    "updated_at": _now(),
                },
            )
            await session.execute(stmt)
            await session.commit()

    # -------------------------------------------------------------- leaderboard
    async def get_leaderboard(self, challenge_slug: str) -> list[dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PlaygroundLeaderboard)
                .where(PlaygroundLeaderboard.challenge_slug == challenge_slug)
                .order_by(PlaygroundLeaderboard.time_seconds.asc())
            )
            return [_to_dict(r) for r in result.scalars().all()]

    async def get_leaderboard_entry(self, session_id: str) -> dict[str, Any] | None:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PlaygroundLeaderboard).where(
                    PlaygroundLeaderboard.session_id == session_id
                )
            )
            row = result.scalar_one_or_none()
            return _to_dict(row) if row else None

    async def add_leaderboard_entry(
        self, *, session_id: str, challenge_slug: str, username: str, time_seconds: int
    ) -> dict[str, Any]:
        async with self._session_factory() as session:
            row = PlaygroundLeaderboard(
                session_id=session_id,
                challenge_slug=challenge_slug,
                username=username,
                time_seconds=time_seconds,
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_dict(row)

    # -------------------------------------------------------------------- inbox
    async def add_email(
        self, *, from_address: str, subject: str, body: str, label: str
    ) -> dict[str, Any]:
        async with self._session_factory() as session:
            row = PlaygroundInbox(
                from_address=from_address, subject=subject, body=body, label=label
            )
            session.add(row)
            await session.commit()
            await session.refresh(row)
            return _to_dict(row)

    async def read_inbox(self, label: str) -> list[dict[str, Any]]:
        async with self._session_factory() as session:
            result = await session.execute(
                select(PlaygroundInbox).where(PlaygroundInbox.label == label)
            )
            return [_to_dict(r) for r in result.scalars().all()]
