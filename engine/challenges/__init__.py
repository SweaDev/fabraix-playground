"""Challenge configuration package for the Fabraix Playground engine.

Self-contained: this package loads challenge definitions from the local
``challenges/`` directory and exposes a small lookup API. It depends on nothing
host-specific.
"""

from .loader import (
    get_active_challenges,
    get_all_challenges,
    get_challenge,
    load_challenges,
)
from .models import ChallengeConfig

__all__ = [
    "ChallengeConfig",
    "get_active_challenges",
    "get_all_challenges",
    "get_challenge",
    "load_challenges",
]
