"""Small datetime helpers shared across the playground engine.

The store renders timestamps as ISO 8601 strings on the way out, so callers that
do duration math need to coerce them back to aware datetimes. Kept in one place
so the parsing rules don't drift between the API router and the tool handlers.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def parse_dt(value: Any) -> datetime | None:
    """Coerce an ISO string / datetime into an aware datetime (or None)."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None


def solve_duration_seconds(session: dict[str, Any]) -> int:
    """Seconds between session creation and the win (solved_at - created_at).

    Falls back to now - created_at when solved_at is unset; returns 0 when the
    session has no created_at.
    """
    created_at = parse_dt(session.get("created_at"))
    solved_at = parse_dt(session.get("solved_at")) or datetime.now(timezone.utc)
    if created_at is None:
        return 0
    return int((solved_at - created_at).total_seconds())
