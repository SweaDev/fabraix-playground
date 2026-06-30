"""Entrypoint for the Fabraix Playground engine.

Builds the `Platform` (SQLite store + LLM-judge guardrail + litellm LLM +
env settings), mounts the `/v1/playground/*` router onto a FastAPI app with
permissive CORS, and runs uvicorn.

Run from the repository root so the `engine` package is importable:

    python -m engine.main

Recognised environment variables (see `.env.example`):
    SQLITE_URL  — aiosqlite URL (default sqlite+aiosqlite:///./playground.db)
    PORT        — listen port (default 8000)
    plus everything `engine.adapters.oss.EnvSettings` reads.
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .app import create_router
from .adapters.oss import build_oss_platform
from .seed import seed_challenges

DEFAULT_SQLITE_URL = "sqlite+aiosqlite:///./playground.db"


@asynccontextmanager
async def _lifespan(app: FastAPI):
    """Build the platform on startup and mount the router.

    The platform build is async (it creates the SQLite schema on first run) and
    seeds the challenge inboxes, so it runs here before the app serves traffic.
    """
    sqlite_url = os.environ.get("SQLITE_URL", DEFAULT_SQLITE_URL)
    platform = await build_oss_platform(sqlite_url)
    await seed_challenges(platform)
    app.include_router(create_router(platform))
    yield


def create_app() -> FastAPI:
    """Build the FastAPI app with the platform wired in (via the lifespan hook)."""
    app = FastAPI(title="Fabraix Playground", lifespan=_lifespan)

    # Public, unauthenticated playground API: any origin may call it, but
    # credentials are NOT allowed. Reflecting every origin together with
    # credentials is the CORS vulnerability class we avoid here — and this
    # engine has no cookies/sessions to expose, so disabling credentials
    # costs nothing.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()


def main() -> None:
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
