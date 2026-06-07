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

    # Optional inbox seed data (data-exfil challenges seed the shared inbox).
    seed_path = challenge_dir / "inbox_seed.yaml"
    if seed_path.exists():
        with open(seed_path) as f:
            config_data["inbox_seed"] = yaml.safe_load(f) or []

    config_data["slug"] = challenge_dir.name

    return ChallengeConfig(**config_data)


def load_challenges() -> dict[str, ChallengeConfig]:
    """Load all challenges from the filesystem."""
    challenges: dict[str, ChallengeConfig] = {}

    for challenge_dir in sorted(CHALLENGES_DIR.iterdir()):
        if not challenge_dir.is_dir():
            continue

        challenge = _load_challenge(challenge_dir)
        if challenge:
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
