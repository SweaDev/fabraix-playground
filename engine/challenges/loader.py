"""Challenge loader - loads challenge configs from YAML files."""

import logging
from pathlib import Path

import yaml

from .models import ChallengeConfig

logger = logging.getLogger(__name__)

CHALLENGES_DIR = Path(__file__).parent / "library"


def _load_challenge(challenge_dir: Path) -> ChallengeConfig | None:
    """Load a single challenge from its directory."""
    config_path = challenge_dir / "config.yaml"
    prompt_path = challenge_dir / "system_prompt.txt"

    if not config_path.exists():
        logger.warning("challenge.missing_config slug=%s", challenge_dir.name)
        return None

    with open(config_path) as f:
        config_data = yaml.safe_load(f)

    # Load system prompt from separate file, fall back to config.yaml field
    if prompt_path.exists():
        with open(prompt_path) as f:
            config_data["system_prompt"] = f.read()

    config_data["slug"] = challenge_dir.name

    return ChallengeConfig(**config_data)


def load_challenges() -> dict[str, ChallengeConfig]:
    """Load all challenges from the filesystem, OLDEST FIRST.

    Ordered by prize-period ``start`` (ties broken by slug), so the newest challenge is
    always last — the order ``GET /challenges`` serves and the frontend's "the active
    challenge is the latest one" reads off. Directory name is not that order: a slug
    sorts alphabetically, so a new challenge can land anywhere in the list.
    """
    challenges: dict[str, ChallengeConfig] = {}
    loaded: list[ChallengeConfig] = []

    for challenge_dir in sorted(CHALLENGES_DIR.iterdir()):
        if not challenge_dir.is_dir():
            continue

        challenge = _load_challenge(challenge_dir)
        if challenge:
            loaded.append(challenge)

    for challenge in sorted(loaded, key=lambda c: (c.start, c.slug)):
        challenges[challenge.slug] = challenge
        logger.info("challenge.loaded slug=%s", challenge.slug)

    logger.info("challenges.load_complete count=%d", len(challenges))
    return challenges


# Load once at import time
_challenges = load_challenges()


def get_challenge(slug: str) -> ChallengeConfig | None:
    """Get a challenge by slug."""
    return _challenges.get(slug)


def get_all_challenges() -> list[ChallengeConfig]:
    """Get all loaded challenges."""
    return list(_challenges.values())


def get_active_challenges() -> list[ChallengeConfig]:
    """Get all active challenges."""
    return [c for c in _challenges.values() if c.is_active]
