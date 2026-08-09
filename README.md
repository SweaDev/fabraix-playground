# Fabraix Playground

Fabraix Playground is an open-source CTF for AI agents. Every week, we deploy a live agent with real tools, publish its full system prompt and challenge configuration, and invite anyone to break it for cash prizes.

Thousands of attempts against the same system show us which attacks work, which defenses hold, and what current models are actually capable of.

**[playground.fabraix.com](https://playground.fabraix.com)**

![Fabraix Playground](public/playground.png)

## How it works

Each challenge puts a live AI agent in front of you with a specific persona, a set of tools (web search, browsing, and more), and a secret it's been instructed to protect. The system prompt is fully visible. Your job is to get past the guardrails and extract the secret anyway.

- **Play instantly** — start sending messages right away, no account required.
- **Pick your opponent** — choose which model you face from a set of named challengers; each one is a different defender under the hood.
- **Sign in to compete** — log in with Google *before* you solve to submit your breaks under a display name you choose.
- **Most breaks wins** — each week, the player with the most *approved* breaks wins a cash prize, then a fresh challenge goes live. Every submission is reviewed before it lands on the leaderboard.

The platform has dedicated views for the current challenge, the live chat, the weekly leaderboard, your previous chats, your submissions and their review status, and the prizes.

## Project structure

- [`/src`](src/) — React frontend (TypeScript, Vite, Tailwind) — the app you play in
- [`/engine`](engine/) — a reference implementation of how the defender agent is wired ([read it](engine/README.md))
- [`/challenges`](challenges/) — every challenge config and system prompt, versioned and open

Guardrail evaluation runs server-side to prevent client-side tampering.

## Run locally

```bash
npm install
npm run dev
```

The app connects to the live Fabraix API by default.

## Get involved

- [Propose a challenge](CONTRIBUTING.md) — design the next scenario the community takes on
- [Suggest agent capabilities](CONTRIBUTING.md#suggest-agent-capabilities) — new tools, behaviors, or workflows
- [Report bugs](CONTRIBUTING.md#report-bugs) — if something's broken
- [Discord](https://discord.gg/n4scEY9NF6) — discuss techniques, share approaches

## About Fabraix

We build AI agents to find vulnerabilities in other AI agents at [Fabraix](https://fabraix.com). The Playground is how we stress-test defenses in the open and how the broader community contributes to the shared understanding of AI security and failure modes. The more people probing these systems, the better the outcomes for everyone building with AI.

