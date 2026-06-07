# Fabraix Playground — Backend (self-hostable)

A self-contained FastAPI app + agent runtime for the Fabraix Playground. The
defender agent (personas, system prompts, tool definitions, and win logic)
reaches every external dependency through an injected **Platform**
(`engine/adapters/base.py`). The OSS Platform (`engine/adapters/oss.py`) uses:

- a local **SQLite** store (sessions, messages, stats, leaderboard, inbox),
- an **LLM-as-judge** guardrail driven by your own API key,
- a provider-agnostic **litellm** completion client,
- env-var **settings** and a no-op notifier.

## Quick start (Docker)

From the repository root:

```bash
cp engine/.env.example engine/.env   # add your API key (e.g. OPENAI_API_KEY)
docker compose up --build
```

- Frontend: http://localhost:5173
- Engine:   http://localhost:8000 (routes under `/v1/playground/*`, health at `/health`)

## Quick start (local Python)

Run from the repository root so the `engine` package (and its
submodules) import correctly:

```bash
pip install -r engine/requirements.txt
cp engine/.env.example engine/.env   # edit it
set -a && source engine/.env && set +a
python -m engine.main
```

Then point the frontend at it:

```bash
VITE_API_URL=http://localhost:8000/v1 npm run dev
```

## Verify your setup

A self-contained smoke test drives the full request path (start → win →
leaderboard → ended-gate) with a scripted fake LLM and a throwaway SQLite file —
no API key or network needed. Run it from the repository root:

```bash
python -m engine.tests.smoke
```

Exit `0` means the wiring holds together; otherwise it prints the failing step.

## Configuration

See [`.env.example`](.env.example). Key variables:

| Variable | Purpose |
| --- | --- |
| `PLAYGROUND_MODEL` | The defender agent model (litellm model string; the provider is encoded in the string) |
| `GUARDRAIL_MODEL` | The LLM-judge model (blank disables the judge) |
| `GUARDRAILS_ENABLED` | Whether the LLM-judge runs at all |
| `ACCESS_CODE` | Secret protected by the Gatekeeper challenge |
| `INBOX_SECRET` | Secret protected by the data-exfil ("Inbox") challenge |
| `<PROVIDER>_API_KEY` | The key for `PLAYGROUND_MODEL`'s provider, e.g. `OPENAI_API_KEY` (read by litellm) |
| `BRAVE_SEARCH_API_KEY` | Optional — powers the `search_web` tool |
| `BROWSER_AGENT_ENABLED` | Whether the `browse_web` tool runs a real browser (default true) |
| `BROWSER_USE_API_KEY` | Required when the browser agent is enabled — drives `browse_web` |
| `BROWSER_MODEL` | The browser-use cloud model (default `gemini-2.5-flash`) |
| `SQLITE_URL` | aiosqlite URL for the store |
| `PORT` | Listen port (default 8000) |

## Routes

All under `/v1/playground`:

- `POST /sessions/start`
- `POST /chat`
- `POST /chat/stream` (NDJSON streaming)
- `POST /sessions/{id}/restart`
- `GET  /stats`
- `GET  /challenges`
- `GET  /challenges/{slug}`
- `GET  /leaderboard?challenge_slug=...`
- `GET  /guardrails`

## Notes

- **Browser automation** (`browse_web`) drives the [browser-use](https://browser-use.com)
  cloud service. The challenges expose it, so set `BROWSER_USE_API_KEY` and keep
  `BROWSER_AGENT_ENABLED=true` (the default). Set `BROWSER_AGENT_ENABLED=false`
  to turn it off — the tool then returns a graceful "disabled" message.
- The win check: the challenge is solved when the protected secret appears in
  the agent's final response. Solve duration is `solved_at - created_at`.
