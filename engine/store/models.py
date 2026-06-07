"""Playground schema — SQLAlchemy models.

Schema-less (runs on a plain SQLite file) with Python-side id / timestamp
defaults (sessions, messages, stats, leaderboard, inbox).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship


def _pid(prefix: str) -> Column:
    """Text PK with a Python-side `{prefix}_{uuid_hex}` default (SQLite-safe)."""
    return Column(Text, primary_key=True, default=lambda: f"{prefix}_{uuid.uuid4().hex}")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class PlaygroundSession(Base):
    __tablename__ = "sessions"
    __table_args__ = (
        Index("idx_playground_sessions_challenge_slug", "challenge_slug"),
        Index("idx_playground_sessions_created_at", "created_at"),
        Index("idx_playground_sessions_success", "success"),
        Index("idx_playground_sessions_agent_model", "agent_model"),
        Index("idx_playground_sessions_guardrails_model", "guardrails_model"),
        Index("idx_playground_sessions_user_identifier", "user_identifier"),
    )

    id = _pid("playsess")
    guardrails_run_id = Column(Text, nullable=False, unique=True)
    challenge_slug = Column(Text, nullable=False)
    success = Column(Boolean, nullable=False, default=False)
    message_count = Column(Integer, nullable=False, default=0)
    last_message_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    solved_at = Column(DateTime(timezone=True))
    ended_at = Column(DateTime(timezone=True))
    user_identifier = Column(Text, nullable=False)
    agent_model = Column(Text, nullable=False)
    guardrails_model = Column(Text)
    browser_model = Column(Text)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    messages = relationship("PlaygroundMessage", back_populates="session")
    leaderboard_entry = relationship(
        "PlaygroundLeaderboard", back_populates="session", uselist=False
    )


class PlaygroundMessage(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("idx_playground_messages_session_id", "session_id"),
        Index("idx_playground_messages_role", "role"),
        Index("idx_playground_messages_created_at", "created_at"),
    )

    id = _pid("playmsg")
    session_id = Column(Text, ForeignKey("sessions.id"), nullable=False)
    role = Column(Text, nullable=False)
    content = Column(Text, nullable=False)
    tools = Column(JSON)
    # Optional author rationale for the message ("why I'm sending this"). NULL for
    # ordinary players; an automated client may attach its per-message reasoning
    # here. Stored only — never fed back into the agent's prompt.
    thinking = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    session = relationship("PlaygroundSession", back_populates="messages")


class PlaygroundStats(Base):
    __tablename__ = "stats"
    __table_args__ = (Index("idx_playground_stats_challenge_slug", "challenge_slug"),)

    id = _pid("playstat")
    challenge_slug = Column(Text, nullable=False, unique=True)
    total_attempts = Column(Integer, nullable=False, default=0)
    successful_attempts = Column(Integer, nullable=False, default=0)
    total_messages = Column(Integer, nullable=False, default=0)
    avg_messages_per_session = Column(Float)
    best_time_seconds = Column(Integer)
    success_rate = Column(Float, nullable=False, default=0.0)
    last_success_at = Column(DateTime(timezone=True))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)


class PlaygroundLeaderboard(Base):
    __tablename__ = "leaderboard"
    __table_args__ = (
        Index("idx_playground_leaderboard_challenge_slug", "challenge_slug"),
    )

    id = _pid("playlb")
    session_id = Column(Text, ForeignKey("sessions.id"), nullable=False, unique=True)
    challenge_slug = Column(Text, nullable=False)
    username = Column(Text, nullable=False)
    time_seconds = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    session = relationship("PlaygroundSession", back_populates="leaderboard_entry")


class PlaygroundInbox(Base):
    __tablename__ = "inbox"
    __table_args__ = (Index("idx_playground_inbox_label", "label"),)

    id = _pid("playmail")
    from_address = Column(Text, nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    label = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
