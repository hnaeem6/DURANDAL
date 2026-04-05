# DURANDAL

> Your unbreakable AI workforce. Runs local. Stays private. Gets smarter.

DURANDAL is a local-first AI automation platform for small businesses. It combines [Hermes Agent](https://github.com/NousResearch/hermes-agent) (self-improving AI brain) with [NanoClaw](https://github.com/qwibitai/nanoclaw) (container-isolated tool execution) behind a clean web dashboard.

## Quick Start

```bash
# Prerequisites: Docker, Node.js 22+, pnpm 10+
git clone https://github.com/your-org/durandal.git
cd durandal
pnpm install
pnpm build

# Start all services
cd docker
cp .env.example .env
docker compose up -d
```

Open https://localhost to set up your account.

## Development

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start dev servers (hot reload)
pnpm build            # Production build
pnpm lint             # Run linter
pnpm typecheck        # Run type checker
```

## Architecture

- **Brain:** Hermes Agent (Python) — planning, memory, multi-LLM routing, skill building
- **Hands:** NanoClaw (TypeScript) — container-isolated tool execution, messaging channels
- **Face:** Dashboard (Next.js) — web UI for non-technical users

See [Architecture Docs](docs/superpowers/specs/2026-04-05-durandal-platform-design.md) for the full design.

## License

Core platform: MIT. See [LICENSES/](LICENSES/) for full attribution.

Premium features: [BSL 1.1](LICENSES/DURANDAL-BSL.md) — converts to MIT after 3 years.
