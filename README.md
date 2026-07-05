# Fabraix Playground

AI agents are reshaping how we work. The repetitive, mechanical parts, the work that consumed human time without requiring human creativity, are increasingly handled by systems designed for exactly that. What's left is the work that matters most: the thinking, the judgment, the creative leaps that only people bring. We think this is one of the most exciting shifts in how software gets built and used, and it's only the beginning.

The ultimate enabler for all of it is trust. None of it scales until people can hand real tasks to an agent and know it will do what it should — and nothing it shouldn't. That trust can't be built by any single team behind closed doors. It has to be earned collectively, in the open, by a community of researchers, engineers, and the genuinely curious, all pressure-testing the same systems and sharing what they find.

The Playground exists to make that effort tangible. Every challenge deploys a live AI agent, not a toy scenario or a mocked-up document parser, but an agent with real capabilities, and opens it up for the community to break. System prompts are published. Challenge configs are versioned in the open. Each week a fresh challenge goes live, and the open, collective effort to break it forces better defenses, which invite harder challenges, which produce deeper understanding.

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

