# DURANDAL

> Your unbreakable AI workforce. Runs local. Stays private. Gets smarter.

DURANDAL is a local-first AI automation platform for small businesses. Deploy intelligent agents that handle invoicing, email triage, scheduling, and more — while your data never leaves your building.

## Key Features

- **Local-first** — runs on your laptop or server, no cloud required
- **Self-improving** — learns from every task via persistent memory
- **Container-isolated** — every action runs in a fresh Linux container
- **Multi-LLM** — Ollama (local) + OpenAI/Anthropic/Google (optional)
- **Business templates** — pre-built automations for common tasks
- **Human-in-the-loop** — approval gates for sensitive actions
- **Enterprise-ready** — auth, RBAC, audit logs, encrypted credential vault

## Quick Start

```bash
curl -fsSL https://durandal.ai/install | sh
```

Or manually:

```bash
git clone https://github.com/your-org/durandal.git
cd durandal
pnpm install && pnpm build
cd docker && cp .env.example .env
# Edit .env — set NEXTAUTH_SECRET and DURANDAL_API_TOKEN
docker compose up -d
```

Open https://localhost to create your admin account.

## Architecture

```
Dashboard (Next.js) → API Layer → Hermes Agent (Python, brain)
                                 → NanoClaw (TypeScript, container executor)
                                 → Ollama (local LLM)
```

- **Brain:** [Hermes Agent](https://github.com/NousResearch/hermes-agent) — planning, memory, multi-LLM routing
- **Hands:** [NanoClaw](https://github.com/qwibitai/nanoclaw) — container-isolated tool execution
- **Face:** Dashboard — web UI for non-technical users

## Project Structure

```
durandal/
├── apps/dashboard/     # Next.js 15 dashboard (UI + API)
├── packages/
│   ├── core/           # Shared types, template engine, license
│   ├── db/             # Drizzle ORM + SQLite schema
│   └── vault/          # AES-256-GCM credential encryption
├── vendors/
│   ├── hermes-agent/   # AI brain (git subtree)
│   └── nanoclaw/       # Container executor (git subtree)
├── templates/          # Business automation templates (YAML)
├── deploy/
│   ├── helm/           # Kubernetes Helm chart
│   └── terraform/      # GCP infrastructure
├── docker/             # Docker Compose + Dockerfiles
├── scripts/            # Installer, backup, CLI, Ollama setup
└── docs/site/          # Documentation (Nextra)
```

## Built-in Templates

| Template | Category | Schedule |
|----------|----------|----------|
| Invoice Processing | Finance | Weekdays 9am |
| Email Triage | Communication | 3x daily |
| Social Media Posting | Marketing | On-demand |
| Inventory Alerts | Operations | Daily 7am |
| Customer Support Triage | Support | Every 30min |

## Development

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev servers
pnpm build            # Production build
pnpm lint             # Lint
pnpm typecheck        # Type check
```

## Deployment

- **On-prem:** `docker compose up -d` (default)
- **GCP:** Helm chart + Terraform (see deploy/)
- **Air-gap:** Pre-pulled images + bundled model weights

See [docs](docs/site/) for full deployment guide.

## CLI

```bash
./scripts/durandal.sh start     # Start services
./scripts/durandal.sh stop      # Stop services
./scripts/durandal.sh status    # Service health
./scripts/durandal.sh logs      # Live logs
./scripts/durandal.sh backup    # Create backup
./scripts/durandal.sh restore   # Restore from backup
./scripts/durandal.sh update    # Pull updates
./scripts/durandal.sh version   # Show version
```

## Security

5 layers of defense-in-depth:
1. Network perimeter (Caddy TLS, internal Docker network)
2. Auth + RBAC (Owner/Admin/Member)
3. Container isolation (cap-drop ALL, no-new-privileges, resource limits)
4. Data protection (AES-256-GCM vault, append-only audit log)
5. Prompt injection defense (tool allowlisting, approval gates)

## License

Core platform: MIT. See [LICENSES/](LICENSES/) for attribution.
Premium features: [BSL 1.1](LICENSES/DURANDAL-BSL.md) — converts to MIT after 3 years.

Built with [Hermes Agent](https://github.com/NousResearch/hermes-agent) and [NanoClaw](https://github.com/qwibitai/nanoclaw).
