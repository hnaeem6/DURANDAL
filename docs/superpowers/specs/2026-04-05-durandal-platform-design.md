# DURANDAL Platform Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Author:** Hamza Naeem + Claude

---

## 1. Product Name, Tagline, and Positioning

**Name:** DURANDAL
**Tagline:** Your unbreakable AI workforce. Runs local. Stays private. Gets smarter.

**Elevator Pitch:** DURANDAL is an AI automation platform that runs entirely on your hardware — no cloud required. Deploy intelligent agents that handle invoicing, email triage, scheduling, and more, while your data never leaves your building. Powered by a self-improving AI brain that learns your business patterns over time.

**Name Origin:** Named after the legendary unbreakable sword, symbolizing secure, local-first execution that cuts through business obstacles with legendary reliability. Unofficially, it's also our "Do-Randal" button — like hiring an automated, hyper-competent version of Randal the snitch from Recess to supervise everything and tirelessly get tasks done.

### Key Differentiators vs Zapier / Make.com / Cloud Agents

1. **Your data never leaves your building** — runs on your laptop or server, not someone else's cloud
2. **Gets smarter over time** — Hermes's skill-building loop learns from every successful task, unlike static workflow tools
3. **OS-level security per task** — every action runs in its own isolated container, not just permission checks
4. **No per-task pricing** — one-time or subscription license, not "credits per zap"
5. **Works offline** — local LLM means no internet dependency for core operations

---

## 2. High-Level System Architecture

### Foundation Components

| Component | Project | Role |
|---|---|---|
| **Brain** | Hermes Agent (Python, MIT, 25.1k stars) | Planning, persistent memory, multi-LLM routing, skill building, sub-agent delegation |
| **Hands** | NanoClaw (TypeScript, MIT, 26.5k stars) | OS-level container-isolated tool execution, messaging channels, cron scheduling |
| **Face** | DURANDAL Dashboard (Next.js, custom) | Web UI for non-technical users, task management, template gallery, audit logs |

### Why NanoClaw over OpenClaw

NanoClaw was chosen over OpenClaw (348k stars) for these reasons:

- **3,900 lines vs 434,000 lines** — fully auditable, forkable, understandable
- **~50MB RAM vs 1GB+** — fits on any laptop
- **OS-level container isolation per chat session** — structural security vs application-level permission checks
- **No known CVEs** — OpenClaw had CVE-2026-25253 (RCE affecting 135,000 instances)
- **Designed to be forked and modified** — OpenClaw is config-driven and fragile to fork

**Key fork modification:** NanoClaw's default Claude Agent SDK dependency is replaced with Hermes's multi-LLM router, enabling local Ollama inference and 15+ cloud providers instead of Claude-only.

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DURANDAL DASHBOARD (Next.js)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Task Mgr │ │ Template │ │  Audit   │ │  Agent   │ │ Settings │ │
│  │          │ │  Gallery │ │   Logs   │ │ Monitor  │ │  & Auth  │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                    DURANDAL API LAYER (Next.js API Routes)          │
│            REST + WebSocket — Auth, RBAC, Rate Limiting             │
├─────────────────────┬───────────────────────────────────────────────┤
│                     │                                               │
│  HERMES AGENT       │        NANOCLAW (forked)                      │
│  (Python, primary   │        (TypeScript, executor)                 │
│   decision-maker)   │                                               │
│                     │                                               │
│  ┌───────────────┐  │  ┌───────────────────────────────────────┐    │
│  │ Planning &    │  │  │ Container Runner                      │    │
│  │ Orchestration │──┼─▶│ (OS-level isolation per task)         │    │
│  ├───────────────┤  │  ├───────────────────────────────────────┤    │
│  │ Persistent    │  │  │ Channel Registry                      │    │
│  │ Memory        │  │  │ (WhatsApp, Telegram, Slack, Discord,  │    │
│  │ (SQLite+MD)   │  │  │  Email via skills)                    │    │
│  ├───────────────┤  │  ├───────────────────────────────────────┤    │
│  │ Skill Builder │  │  │ Task Scheduler (Cron)                 │    │
│  ├───────────────┤  │  ├───────────────────────────────────────┤    │
│  │ Multi-LLM     │  │  │ Group Queue + Concurrency Control     │    │
│  │ Router        │  │  └───────────────────────────────────────┘    │
│  │ (Ollama local │  │                                               │
│  │  + cloud APIs)│  │  Tools (in containers):                       │
│  ├───────────────┤  │  ┌────────┐┌────────┐┌────────┐┌────────┐    │
│  │ Sub-agent     │  │  │Browser ││ File   ││  Exec  ││  Web   │    │
│  │ Delegation    │  │  │Playwrt ││  Ops   ││ Shell  ││ Fetch  │    │
│  └───────────────┘  │  └────────┘└────────┘└────────┘└────────┘    │
├─────────────────────┴───────────────────────────────────────────────┤
│                      PERSISTENCE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ SQLite (WAL)  │  │  Encrypted   │  │ Litestream → Cloud       │  │
│  │ Sessions,     │  │  Credentials │  │ Storage (optional backup) │  │
│  │ Memory, Audit │  │  Vault       │  │                          │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │ Docker       │  │ Ollama       │  │ Caddy (TLS + reverse     │  │
│  │ Engine       │  │ (local LLM)  │  │ proxy)                   │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Integration Model

- **Hermes** (Python, primary decision-maker, runs as separate Docker container) is the brain — planning, memory, multi-LLM routing, skill building, sub-agent delegation
- **NanoClaw** (TypeScript, forked) is the hands — container-isolated tool execution, messaging channels, cron scheduling
- **DURANDAL API** (Next.js API routes) is the glue — REST + WebSocket API that the dashboard consumes, handling auth/RBAC/rate limiting
- **Communication:** Hermes ↔ NanoClaw via local HTTP/IPC. Dashboard ↔ both via the API layer. All on localhost, no network exposure.

### Data Flow Example: "Process Today's Invoices"

```
User clicks "Run" on Invoice Template in Dashboard
        │
        ▼
Dashboard → POST /api/tasks/run {template: "invoice-processing"}
        │
        ▼
Hermes receives task, creates plan:
  1. Check email for new invoices (NanoClaw browser)
  2. Extract data from PDFs (NanoClaw file ops)
  3. Match against known vendors (Hermes memory)
  4. Flag anomalies for human review
  5. Update accounting system (NanoClaw browser)
        │
        ▼
NanoClaw spawns isolated container for each step:
  ┌─────────────────────────────────┐
  │ Container 1: Browser → Gmail   │ ← network: limited to Gmail
  │ Container 2: File → PDF parse  │ ← network: none
  │ Container 3: Browser → Xero   │ ← network: limited to Xero
  └─────────────────────────────────┘
        │
        ▼
Hermes reviews results, learns patterns, updates memory
        │
        ▼
Dashboard shows: "3 invoices processed, 1 flagged for review"
        │
        ▼
Audit log: every action recorded with timestamp + container ID
```

### LLM Strategy: Local-First with Optional Cloud Upgrade

- **Default:** Ollama running Qwen2.5 7B (or Llama 3.1 8B) locally. Works offline, no API keys needed.
- **Optional:** Users can add API keys for OpenAI, Anthropic, Google, etc. for stronger reasoning on complex tasks.
- **Hermes handles routing:** Uses local model for simple tasks, cloud model for complex ones (configurable).
- **Fallback chain:** Cloud API fails → fall back to local model. Always operational.

---

## 3. Tech Stack Additions (Beyond Hermes + NanoClaw)

| Layer | Technology | Version | Why |
|---|---|---|---|
| **Dashboard** | Next.js + React | 15.x | SSR, API routes, huge ecosystem |
| **UI Components** | shadcn/ui + Tailwind CSS | 4.x | Copy-paste components, no runtime dep, accessible |
| **Real-time** | Socket.IO | 4.x | Live agent status, streaming responses |
| **Auth** | Auth.js (NextAuth) | 5.x | Credentials + optional OIDC/SAML. Local-first, no cloud dep |
| **RBAC** | Custom (3 roles) | — | Owner → Admin → Member. Simple, fits SMB org charts |
| **Database** | SQLite (better-sqlite3) | WAL mode | Zero config, single-file backup, both upstream repos use it |
| **ORM / Query** | Drizzle ORM | 0.3x | Type-safe, lightweight, SQLite + Postgres adapters built-in |
| **Backup** | Litestream | 0.3.x | Continuous SQLite replication to S3/GCS (optional) |
| **Containers** | Docker + Docker Compose | 27.x / 2.x | Industry standard, both upstream repos support it |
| **Reverse Proxy** | Caddy | 2.x | Auto HTTPS, zero config TLS |
| **Local LLM** | Ollama | latest | One-command model management |
| **Monitoring** | Pino (logging) + built-in health | 9.x | Structured JSON logs, low overhead |
| **Secrets** | AES-256 encrypted vault (SQLite) | — | API keys encrypted at rest, master key derived from user password |
| **TS Package Mgmt** | pnpm | 10.x | Monorepo workspaces |
| **Python Package Mgmt** | uv | 0.6.x | Upstream Hermes uses it |
| **Build Pipeline** | Turborepo | latest | Fast incremental builds across monorepo |

---

## 4. Monorepo Project Structure

```
durandal/
├── apps/
│   └── dashboard/              # Next.js 15 app (SSR + API routes)
│       ├── src/
│       │   ├── app/              # App Router pages
│       │   ├── components/       # shadcn/ui + custom components
│       │   ├── lib/              # API clients, auth, utils
│       │   └── hooks/            # React hooks (WebSocket, agents)
│       ├── package.json
│       └── next.config.js
│
├── packages/
│   ├── core/                   # Shared types, schemas, constants
│   ├── db/                     # Drizzle schema + migrations + data access
│   ├── auth/                   # Auth logic, RBAC, session management
│   ├── api/                    # API bridge: Dashboard ↔ Hermes ↔ NanoClaw
│   └── vault/                  # Encrypted credential storage
│
├── vendors/
│   ├── hermes-agent/           # Git subtree from NousResearch/hermes-agent
│   └── nanoclaw/               # Git subtree from qwibitai/nanoclaw (forked)
│
├── templates/
│   ├── invoice-processing.yaml  # Business automation templates
│   ├── email-triage.yaml
│   ├── social-media.yaml
│   ├── inventory-alerts.yaml
│   └── customer-support.yaml
│
├── docker/
│   ├── Dockerfile.dashboard     # Next.js production build
│   ├── Dockerfile.hermes        # Python + Hermes agent
│   ├── Dockerfile.nanoclaw      # Node.js + NanoClaw
│   ├── Dockerfile.sandbox       # Minimal container for isolated execution
│   ├── docker-compose.yml       # On-prem: all services in one command
│   ├── docker-compose.dev.yml   # Dev overrides (hot reload, debug)
│   └── .env.example             # Template for secrets
│
├── scripts/
│   ├── install.sh               # One-command installer
│   ├── update.sh                # Pull new images + migrate
│   ├── backup.sh                # Export SQLite + memory + skills
│   └── setup-ollama.sh          # Download default local model
│
├── docs/
│   ├── architecture.md
│   ├── deployment.md
│   ├── templates.md
│   └── security.md
│
├── LICENSES/
│   ├── MIT-hermes-agent.txt     # Original Hermes MIT license
│   ├── MIT-nanoclaw.txt         # Original NanoClaw MIT license
│   ├── NOTICE.md                # Attribution summary with links
│   └── DURANDAL-BSL.md          # Business Source License for premium features
│
├── pnpm-workspace.yaml          # Monorepo workspace config
├── turbo.json                   # Turborepo build pipeline
├── package.json                 # Root scripts + devDeps
└── README.md
```

### Key Decisions

- **`vendors/`** uses git subtrees (not submodules) — easier for contributors, allows patching upstream code, `git subtree pull` for updates
- **`packages/`** contains shared TypeScript code — clean separation between dashboard, API bridge, auth, db, and vault
- **`templates/`** holds business automation YAML definitions — templates are the product differentiator
- **`docker/`** has separate Dockerfiles per service — compose brings them all together
- **`LICENSES/`** preserves all original MIT notices alongside DURANDAL's commercial license

---

## 5. MVP Feature List (Prioritized)

### Phase 0: Project Setup (Week 1-2)

| # | Feature | Acceptance Criteria |
|---|---|---|
| 1 | Monorepo scaffold | `pnpm build` succeeds from root, all packages resolve |
| 2 | Vendor integration | Both upstream repos pulled via git subtree, original tests pass in CI |
| 3 | Docker Compose skeleton | `docker compose up` starts all 5 services, health checks pass |
| 4 | CI pipeline | GitHub Actions: lint, test, build, Docker image push. PR checks run in < 5 min |
| 5 | License compliance | LICENSES/ directory with MIT texts, NOTICE file, attribution in build output |

### Phase 1: Core Integration (Week 3-6)

| # | Feature | Acceptance Criteria |
|---|---|---|
| 1 | Hermes ↔ NanoClaw bridge | Hermes sends "browse URL" task, NanoClaw executes in isolated container, result returns to Hermes |
| 2 | Unified task API | POST /api/tasks creates a task, GET /api/tasks/:id returns status + output, DELETE cancels |
| 3 | LLM router setup | Agent completes a task using only local model. Adding an API key enables cloud fallback |
| 4 | WebSocket event stream | Dashboard receives real-time: task started → steps executing → completed/failed |
| 5 | Persistent memory integration | Agent remembers vendor names and patterns from previous invoice runs across sessions |
| 6 | Basic CLI | `durandal start`, `durandal stop`, `durandal status`, `durandal logs` work correctly |

### Phase 2: Security & Dashboard (Week 7-10)

| # | Feature | Acceptance Criteria |
|---|---|---|
| 1 | Auth system | First launch shows setup wizard. Login persists via secure HTTP-only cookie. Session expires after configurable timeout |
| 2 | RBAC (Owner/Admin/Member) | Members can run tasks and view logs. Admins manage templates and users. Owners manage security and billing |
| 3 | Dashboard pages | Home (status), Tasks (run/monitor), Templates (gallery), Agents (memory/skills), Audit Log, Settings. Non-technical user can run a template without touching a terminal |
| 4 | Credential vault | Credentials encrypted at rest (AES-256-GCM), decrypted only in-memory during task execution, never logged or exposed in UI |
| 5 | Audit logging | Every agent action, user action, and API call logged. Queryable by date/type/user. Exportable CSV/JSON. Append-only table |
| 6 | Container security hardening | Sandbox containers: no network by default, domain allowlists per template, `--cap-drop ALL`, `--no-new-privileges`, `--pids-limit 128` |

### Phase 3: Business Templates (Week 11-14)

| # | Feature | Acceptance Criteria |
|---|---|---|
| 1 | Template engine | YAML-defined templates with steps, required credentials, network allowlists, and human-review gates. Hermes interprets, NanoClaw executes |
| 2 | 5 launch templates | Invoice processing, Email triage, Social media posting, Inventory alerts, Customer support triage. Each works end-to-end with live demo |
| 3 | Human-in-the-loop gates | Agent pauses at gate, sends notification to dashboard, waits for user approval/rejection before proceeding |
| 4 | Template marketplace UI | Browse, install, configure templates from dashboard. User clicks "Use", fills config, template appears in task list |
| 5 | Scheduled automations | User sets "Run daily at 9am" on a template. Cron triggers it. Results visible in dashboard |

### Phase 4: Polish & Commercial Packaging (Week 15-18)

| # | Feature | Acceptance Criteria |
|---|---|---|
| 1 | One-command installer | `curl -fsSL https://durandal.ai/install \| sh` — fresh machine to working DURANDAL in < 10 minutes, zero manual config |
| 2 | Update & backup system | `durandal update` pulls new images + migrates. `durandal backup` creates single archive. `durandal restore` works on fresh install |
| 3 | License activation | Offline RSA-signed JSON key. Works without internet. Feature gates enforced in API layer. Free/Pro/Enterprise tiers |
| 4 | Telemetry (opt-in) | Off by default. Settings page shows exactly what's collected. Single toggle. Anonymous counters only |
| 5 | GCP deployment option | Helm chart + Terraform module for Cloud Run / GKE. SQLite → Cloud SQL migration tool. `terraform apply` creates production instance in < 15 min |
| 6 | Documentation site | Getting started, template authoring guide, API reference, security whitepaper. New user can run first template from docs alone |

---

## 6. Security & Isolation Architecture

### Defense-in-Depth: 5 Layers

#### Layer 1: Network Perimeter
- Caddy reverse proxy (TLS termination, auto HTTPS)
- All services on internal Docker network (not exposed to host)
- Only port 443 (HTTPS) exposed externally
- Air-gap mode: no outbound network, local LLM only

#### Layer 2: Authentication & Authorization
- Auth.js session with HTTP-only secure cookies
- RBAC: Owner → Admin → Member (enforced at API layer)
- Setup wizard creates first Owner account on initial boot
- Optional OIDC/SAML for enterprise SSO
- Rate limiting on all API endpoints

#### Layer 3: Task-Level Container Isolation (NanoClaw)
- Every agent task runs in a fresh Linux container
- `--cap-drop ALL`, `--no-new-privileges`, `--pids-limit 128`
- Network: none by default, specific domains allowlisted per template
- Filesystem: read-only root, tmpfs for scratch, mounted workspace only
- Resource limits: CPU (0.5 core), RAM (512MB), disk (1GB) per container
- Container destroyed after task completion (no state leaks)

#### Layer 4: Data Protection
- Credential vault: AES-256-GCM encryption at rest
- Master key derived from owner password via Argon2id
- API keys decrypted only in-memory during task execution
- Audit log: append-only SQLite table (tamper-evident)
- Agent memory: encrypted at rest, no PII in logs
- Litestream backup encryption for cloud replication

#### Layer 5: Prompt Injection Defense
- Input sanitization on all user-facing text fields
- Tool allowlisting per template (agents can't use tools not declared)
- Human-in-the-loop gates before sensitive actions
- Hermes memory injection scanning (blocks prompt injection in memory)
- Output filtering: PII redaction in logs and dashboard
- Template-defined action boundaries (agent can't exceed scope)

### Air-Gap Mode

Full air-gap deployment supported:
- Pre-pulled Docker images via `docker save/load`
- Ollama model weights bundled in the image or loaded from USB
- No telemetry, no license phone-home (offline RSA key validation)
- All outbound network blocked at Docker network level
- Updates via USB/sneakernet: new images loaded manually

---

## 7. Deployment & Installer Strategy

### One-Command Install Experience

```bash
curl -fsSL https://durandal.ai/install | sh
```

The installer:
1. Detects platform (macOS arm64/x86, Linux, Windows/WSL)
2. Checks Docker is installed (installs if needed via official script)
3. Checks disk space (need 10GB) and RAM (need 8GB)
4. Pulls DURANDAL Docker images (3 images, ~2.1GB)
5. Installs Ollama if not present
6. Downloads default model (Qwen2.5 7B, ~4.4GB)
7. Starts all services via Docker Compose
8. Runs health checks
9. Prints dashboard URL

### Hardware Minimums

| Scenario | CPU | RAM | Disk | GPU |
|---|---|---|---|---|
| **Minimum** (local 7B model) | 4 cores | 8GB | 20GB SSD | None (CPU inference) |
| **Recommended** (local + browser) | 6+ cores | 16GB | 40GB SSD | 8GB+ VRAM or Apple M-series |
| **Cloud API mode** (no local LLM) | 2 cores | 4GB | 10GB SSD | None |

### Docker Compose (Production)

5 services on an internal-only bridge network:
- **dashboard** (Next.js) — the web UI
- **hermes** (Python) — AI brain, exposed on internal port 8642
- **nanoclaw** (Node.js) — tool executor, spawns sandbox containers
- **ollama** — local LLM inference
- **caddy** — reverse proxy, only service with host-mapped ports (80, 443)

Network is `internal: true` — no outbound internet by default. Templates can allowlist specific domains for their sandbox containers.

### Update Mechanism

`durandal update`:
1. Checks for new image tags from registry
2. Pulls new images (delta download)
3. Stops services gracefully
4. Database migrations run automatically on startup
5. Restarts with new images
6. Health check verifies all services
7. Rollback on failure (keeps old images)

### Backup & Restore

`durandal backup` creates `durandal-backup-YYYY-MM-DD.tar.gz` containing:
- All SQLite databases (sessions, memory, audit)
- MEMORY.md and skill files
- Credential vault (encrypted)
- Custom templates
- Configuration

`durandal restore <file>` works on any fresh install.

Optional: Litestream for continuous replication to GCS/S3.

### GCP Scaling Path

```
Docker Compose (on-prem, single server)
        │
        │ same Docker images
        ▼
Cloud Run multi-container (serverless GCP)
  + Cloud SQL (replaces SQLite)
  + Cloud Storage (replaces local disk)
  + Cloud Load Balancer (replaces Caddy)
        │
        │ for larger deployments
        ▼
GKE Autopilot (full Kubernetes)
  + Helm chart with values overrides
  + GPU node pools for local model inference
```

---

## 8. Commercial & Legal Layer

### MIT Compliance & Attribution

Original copyright notices and MIT license text preserved in all vendor/ source files. Never removed or modified.

**LICENSES/ directory in every distribution:**
- `MIT-hermes-agent.txt` — Full NousResearch copyright + MIT text
- `MIT-nanoclaw.txt` — Full qwibitai copyright + MIT text
- `NOTICE.md` — Attribution summary with links to upstream projects
- `DURANDAL-BSL.md` — Business Source License for premium features

NOTICE.md is displayed in the dashboard Settings → About page.

### License Strategy: Open-Core (MIT + BSL 1.1)

**Core platform (MIT):** The full DURANDAL platform is open source. Anyone can use, modify, and distribute. We compete on quality, templates, and support.

**Premium features (BSL 1.1):** SSO (OIDC/SAML), advanced RBAC beyond 1 user, managed GCP hosting, priority support, custom integrations. BSL converts to MIT after 3 years (the MariaDB / Sentry / CockroachDB model). This prevents competitors from reselling while keeping the core open.

### Pricing Tiers

| Tier | Price | Includes |
|---|---|---|
| **Community** | Free | Full platform (MIT), 3 templates, 1 user, local LLM, container isolation, community support |
| **Pro** | $49/mo | Everything in Community + unlimited templates, 10 users + RBAC, cloud LLM integration, priority email support, custom template builder |
| **Enterprise** | Custom | Everything in Pro + unlimited users, SSO (OIDC/SAML), GCP managed hosting, dedicated support + SLA, custom integrations |

### License Activation

- RSA-signed JSON license key
- Public key embedded in application binary
- Validates offline — no phone-home required
- Key contains: tier, user limit, expiry date, org name
- Entered during setup wizard or in Settings
- Optional license server for enterprise (revocation, seat tracking)

### Telemetry (Privacy-First)

- **OFF by default**
- Explicit opt-in toggle in Settings
- Collects only: task counts, error rates, template usage, platform version
- Never collects: task content, credentials, PII, agent memory, business data
- Dashboard shows exactly what data would be sent before enabling
- Can be blocked at network level (air-gap compatible)

---

## Appendix: Research Summary

### NanoClaw vs OpenClaw Decision

| Metric | NanoClaw | OpenClaw |
|---|---|---|
| Codebase | ~3,900 lines (15 files) | ~434,000 lines (3,680 files) |
| RAM at idle | ~50MB | 1GB+ |
| Security model | OS-level container per chat | App-level allowlists + pairing |
| Known CVEs | None | CVE-2026-25253 (RCE, 135k instances) |
| Time to understand | ~8 minutes | 1-2 weeks |
| GitHub Stars | 26.5k | 348k |
| Forkability | Easy — modify source directly | Hard — config-driven, fragile |
| Dashboard | None (CLI only) | Mission Control (Vite+Lit) |
| LLM support | Claude (Agent SDK) | 15+ providers |

NanoClaw won on security, auditability, deployability, and forkability. The missing dashboard and limited LLM support are covered by our custom Next.js dashboard and Hermes's multi-LLM router respectively.

### Integration Pattern

Approach B (Hermes primary, NanoClaw as tool execution backend) was selected. Hermes is the autonomous brain with planning, memory, and multi-model support. NanoClaw provides the container-isolated execution environment. This matches the industry pattern used by Supabase and GitLab: standardize on API contracts, deploy everything in containers, don't try to unify languages.

### Deployment Research

Docker Compose is the industry standard for self-hosted AI products (used by Dify, n8n, Flowise, Langflow, PrivateGPT). Same Docker images scale to GCP via Cloud Run multi-container or GKE Autopilot. SQLite is appropriate for single-server deployments; Postgres adapter available for cloud scaling via Drizzle ORM.
