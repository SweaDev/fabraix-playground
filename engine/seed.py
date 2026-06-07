"""Seed challenge data into the store at startup.

Some challenges need rows present before they can be played — e.g. the data-exfil
"Inbox" challenge requires the shared inbox to already contain the email whose
address is the secret to extract. Seed data lives with the challenge definition
(`inbox_seed.yaml`); the literal '{secret}' in a body is replaced with the
challenge secret here, so the secret itself never ships in the repo.

Seeding is idempotent: a challenge's emails are inserted only when none of its
seed labels already hold messages, so restarts don't duplicate them.
"""

from __future__ import annotations

import structlog

from .adapters.base import Platform
from .challenges import get_all_challenges

logger = structlog.get_logger()


async def seed_challenges(platform: Platform) -> None:
    """Insert each challenge's `inbox_seed` emails into the store if absent."""
    for challenge in get_all_challenges():
        if not challenge.inbox_seed:
            continue

        labels = {email.label for email in challenge.inbox_seed}
        already_seeded = False
        for label in labels:
            if await platform.store.read_inbox(label):
                already_seeded = True
                break
        if already_seeded:
            continue

        secret = platform.settings.secret_for(challenge.slug)
        for email in challenge.inbox_seed:
            await platform.store.add_email(
                from_address=email.from_address,
                subject=email.subject,
                body=email.body.replace("{secret}", secret),
                label=email.label,
            )
        logger.info(
            "playground.inbox_seeded",
            challenge=challenge.slug,
            count=len(challenge.inbox_seed),
        )
