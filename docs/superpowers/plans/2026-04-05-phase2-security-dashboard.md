# Phase 2: Security & Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authentication, role-based access control, a multi-page dashboard with navigation, encrypted credential vault, audit logging, and container security hardening — making DURANDAL production-ready for organizational use.

**Architecture:** Auth.js 5 (NextAuth) with credentials provider for local-first auth. Three-role RBAC (Owner/Admin/Member) enforced at API middleware level. shadcn/ui component library for the dashboard. AES-256-GCM credential vault with Argon2id key derivation. Append-only audit log in SQLite. NanoClaw container hardening via Docker security options.

**Tech Stack additions:** Auth.js 5, bcrypt, shadcn/ui, @radix-ui/*, lucide-react, argon2 (via hash-wasm for portability)

**Spec Reference:** `docs/superpowers/specs/2026-04-05-durandal-platform-design.md` — Phase 2 (Section 5)

**Current State:** Dashboard has 4 API routes (health, tasks CRUD, memory), a single page with task submission, Tailwind v4, no auth, no component library.

---

## Task Overview

| # | Task | Complexity |
|---|---|---|
| 1 | Install shadcn/ui + component library setup | Mechanical |
| 2 | Auth system (Auth.js + credentials provider) | Integration |
| 3 | Setup wizard (first-run Owner account creation) | Integration |
| 4 | RBAC middleware for API routes | Integration |
| 5 | Dashboard layout + navigation shell | UI |
| 6 | Dashboard pages (Home, Tasks, Agents, Settings) | UI |
| 7 | Credential vault (AES-256-GCM) | Crypto |
| 8 | Audit logging system | Integration |
| 9 | Container security hardening | DevOps |
| 10 | Final verification | Verification |

---

### Task 1: Install shadcn/ui + Component Library

**Files:**
- Modify: `apps/dashboard/package.json`
- Create: `apps/dashboard/src/lib/utils.ts`
- Create: `apps/dashboard/src/components/ui/button.tsx`
- Create: `apps/dashboard/src/components/ui/input.tsx`
- Create: `apps/dashboard/src/components/ui/card.tsx`
- Create: `apps/dashboard/src/components/ui/badge.tsx`
- Create: `apps/dashboard/src/components/ui/avatar.tsx`
- Create: `apps/dashboard/src/components/ui/dropdown-menu.tsx`
- Create: `apps/dashboard/src/components/ui/sheet.tsx`
- Create: `apps/dashboard/src/components/ui/separator.tsx`
- Create: `apps/dashboard/src/components/ui/table.tsx`
- Create: `apps/dashboard/src/components/ui/textarea.tsx`
- Create: `apps/dashboard/src/components/ui/label.tsx`
- Create: `apps/dashboard/src/components/ui/tabs.tsx`
- Create: `apps/dashboard/src/components/ui/dialog.tsx`

- [ ] **Step 1: Add dependencies**

Add to `apps/dashboard/package.json` dependencies:
```json
"class-variance-authority": "^0.7.1",
"clsx": "^2.1.1",
"tailwind-merge": "^3.0.0",
"lucide-react": "^0.500.0",
"@radix-ui/react-dropdown-menu": "^2.1.0",
"@radix-ui/react-dialog": "^1.1.0",
"@radix-ui/react-label": "^2.1.0",
"@radix-ui/react-separator": "^1.1.0",
"@radix-ui/react-tabs": "^1.1.0",
"@radix-ui/react-slot": "^1.1.0"
```

Run: `pnpm install`

- [ ] **Step 2: Create utils.ts**

Create `apps/dashboard/src/lib/utils.ts`:
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create UI components**

Create the standard shadcn/ui components. For each component, go to the shadcn/ui source at https://ui.shadcn.com and copy the component code, adapting imports to use `@/lib/utils`. Components needed: Button, Input, Card, Badge, Avatar, DropdownMenu, Sheet, Separator, Table, Textarea, Label, Tabs, Dialog.

IMPORTANT: These are standard shadcn/ui components. Use the latest shadcn/ui patterns. Each component should be a separate file in `apps/dashboard/src/components/ui/`.

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add shadcn/ui component library"
```

---

### Task 2: Auth System (Auth.js + Credentials)

**Files:**
- Modify: `apps/dashboard/package.json` (add next-auth, bcrypt)
- Create: `apps/dashboard/src/lib/auth.ts`
- Create: `apps/dashboard/src/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/dashboard/src/app/login/page.tsx`
- Modify: `packages/db/src/schema.ts` (add sessions table for Auth.js if needed)

- [ ] **Step 1: Add auth dependencies**

```json
"next-auth": "^5.0.0",
"bcrypt": "^6.0.0",
"@types/bcrypt": "^5.0.2"
```

Run: `pnpm install`

NOTE: If bcrypt has native build issues, use `bcryptjs` instead (pure JS, no native deps).

- [ ] **Step 2: Create `apps/dashboard/src/lib/auth.ts`**

Implement Auth.js configuration with a Credentials provider that validates email/password against the users table in SQLite. Use bcrypt for password hashing.

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { createDb, users } from "@durandal/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { config } from "./config";

function getDb() {
  return createDb(config.databaseUrl.replace("file:", ""));
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const db = getDb();
        const user = db
          .select()
          .from(users)
          .where(eq(users.email, credentials.email as string))
          .get();

        if (!user) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash,
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: config.nextAuthSecret,
});
```

- [ ] **Step 3: Create auth API route**

Create `apps/dashboard/src/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

- [ ] **Step 4: Create login page**

Create `apps/dashboard/src/app/login/page.tsx` — a centered card with email/password fields and a "Sign In" button. Use the shadcn/ui components from Task 1 (Button, Input, Card, Label).

Style it with the DURANDAL brand colors (orange gradient header, dark background).

- [ ] **Step 5: Create auth middleware**

Create `apps/dashboard/src/middleware.ts` to protect all routes except `/login` and `/api/auth`:

```typescript
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === "/login";
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");
  const isSetupApi = req.nextUrl.pathname === "/api/setup";

  // Allow auth routes and setup
  if (isAuthApi || isSetupApi) return NextResponse.next();

  // Redirect unauthenticated to login
  if (!isLoggedIn && !isLoginPage) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Redirect authenticated away from login
  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 7: Commit**

```bash
git add apps/dashboard/ packages/db/
git commit -m "feat(dashboard): add Auth.js authentication with credentials provider"
```

---

### Task 3: Setup Wizard (First-Run Owner Creation)

**Files:**
- Create: `apps/dashboard/src/app/setup/page.tsx`
- Create: `apps/dashboard/src/app/api/setup/route.ts`
- Modify: `apps/dashboard/src/middleware.ts`

- [ ] **Step 1: Create setup API endpoint**

Create `apps/dashboard/src/app/api/setup/route.ts`:

Check if any users exist. If none, allow creating the first Owner account. If users exist, return 403.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createDb, users } from "@durandal/db";
import { count } from "drizzle-orm";
import bcrypt from "bcrypt";
import { config } from "@/lib/config";

function getDb() {
  return createDb(config.databaseUrl.replace("file:", ""));
}

export async function GET() {
  const db = getDb();
  const result = db.select({ count: count() }).from(users).get();
  return NextResponse.json({ needsSetup: (result?.count ?? 0) === 0 });
}

export async function POST(req: NextRequest) {
  const db = getDb();

  // Only allow if no users exist
  const result = db.select({ count: count() }).from(users).get();
  if ((result?.count ?? 0) > 0) {
    return NextResponse.json({ error: "Setup already completed" }, { status: 403 });
  }

  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const id = crypto.randomUUID();

  db.insert(users).values({
    id,
    name,
    email,
    passwordHash,
    role: "owner",
    createdAt: new Date(),
  }).run();

  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 2: Create setup page**

Create `apps/dashboard/src/app/setup/page.tsx` — a welcome screen with name, email, password fields to create the first Owner account. On success, redirect to login.

Use DURANDAL branding. Include "Welcome to DURANDAL" header and explanation that this is the first-time setup.

- [ ] **Step 3: Update middleware to handle setup redirect**

Modify `apps/dashboard/src/middleware.ts`: Check if setup is needed (via GET /api/setup). If no users exist and user is not on /setup or /api/setup, redirect to /setup.

NOTE: The middleware can't easily make async DB calls on every request. Instead, check a simple flag or cache the setup status.

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add first-run setup wizard for Owner account creation"
```

---

### Task 4: RBAC Middleware

**Files:**
- Create: `apps/dashboard/src/lib/rbac.ts`
- Modify: API routes to use RBAC checks

- [ ] **Step 1: Create RBAC utility**

Create `apps/dashboard/src/lib/rbac.ts`:

```typescript
import { auth } from "./auth";
import { NextResponse } from "next/server";

type Role = "owner" | "admin" | "member";

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 3,
  admin: 2,
  member: 1,
};

export function hasRole(userRole: string, requiredRole: Role): boolean {
  return (ROLE_HIERARCHY[userRole as Role] ?? 0) >= ROLE_HIERARCHY[requiredRole];
}

export async function requireRole(requiredRole: Role) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userRole = (session.user as any).role as string;
  if (!hasRole(userRole, requiredRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // Access granted
}

export async function getSession() {
  return auth();
}
```

- [ ] **Step 2: Apply RBAC to sensitive API routes**

Add `requireRole("admin")` checks to:
- POST /api/tasks (members can run, but keep it open for now)
- PUT /api/memory (admin only)
- POST /api/setup (already gated by user count)

Add `requireRole("owner")` checks to:
- Settings-related endpoints (created in Task 6)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add RBAC middleware with role hierarchy"
```

---

### Task 5: Dashboard Layout + Navigation Shell

**Files:**
- Create: `apps/dashboard/src/components/nav-sidebar.tsx`
- Create: `apps/dashboard/src/components/nav-header.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/layout.tsx`
- Move: existing page.tsx content into `(dashboard)/page.tsx`

- [ ] **Step 1: Create navigation sidebar component**

A vertical sidebar with:
- DURANDAL logo/text at top
- Nav links: Home, Tasks, Agents, Audit Log, Settings
- User info + sign out at bottom
- Collapsible on mobile (use Sheet component)

Use lucide-react icons: Home, ListChecks, Bot, ScrollText, Settings, LogOut.

- [ ] **Step 2: Create header component**

A top bar with:
- Page title (dynamic)
- Health status indicator (green/yellow/red dot)
- User avatar + role badge

- [ ] **Step 3: Create dashboard route group layout**

Create `apps/dashboard/src/app/(dashboard)/layout.tsx` that wraps all authenticated pages with the sidebar + header.

Move the current `page.tsx` content to `(dashboard)/page.tsx`.

Keep `login/` and `setup/` pages outside the dashboard layout (they don't need nav).

- [ ] **Step 4: Verify build + navigation**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add navigation shell with sidebar and header"
```

---

### Task 6: Dashboard Pages

**Files:**
- Create: `apps/dashboard/src/app/(dashboard)/tasks/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/agents/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/audit/page.tsx`
- Create: `apps/dashboard/src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Tasks page**

A table view showing all tasks with columns: ID (short), Input (truncated), Status (badge), Created At, Actions (view/cancel). Include a "New Task" button that opens a dialog or navigates to the home page.

- [ ] **Step 2: Agents page**

Shows agent memory (MEMORY.md and USER.md) in editable text areas. Displays agent skills if available. Uses the /api/memory endpoint.

- [ ] **Step 3: Audit log page**

Shows audit entries in a table with: Timestamp, Actor, Action, Resource, Details. Include date filter and export CSV button. Uses a new GET /api/audit route.

Create `apps/dashboard/src/app/api/audit/route.ts` that queries the audit_log table.

- [ ] **Step 4: Settings page**

Tabs for: General (version, health), Users (list + invite for admins), Credentials (manage API keys), About (NOTICE.md attribution).

- [ ] **Step 5: Verify build**

Run: `pnpm --filter @durandal/dashboard build`

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add Tasks, Agents, Audit, and Settings pages"
```

---

### Task 7: Credential Vault (AES-256-GCM)

**Files:**
- Create: `packages/vault/package.json`
- Create: `packages/vault/tsconfig.json`
- Create: `packages/vault/src/index.ts`
- Create: `apps/dashboard/src/app/api/credentials/route.ts`

- [ ] **Step 1: Create @durandal/vault package**

A standalone package that provides encrypt/decrypt functions using AES-256-GCM with Argon2id key derivation from a master password.

```typescript
// packages/vault/src/index.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

export function encrypt(plaintext: string, password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = randomBytes(IV_LENGTH);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  // Format: salt:iv:tag:ciphertext (all hex)
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    tag.toString("hex"),
    encrypted,
  ].join(":");
}

export function decrypt(encryptedStr: string, password: string): string {
  const [saltHex, ivHex, tagHex, ciphertext] = encryptedStr.split(":");
  
  const salt = Buffer.from(saltHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const key = deriveKey(password, salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
```

NOTE: Using Node.js built-in `crypto` (scryptSync) instead of Argon2 for simplicity — no native deps needed. Argon2 can be added as an upgrade later.

- [ ] **Step 2: Create credentials API route**

CRUD for encrypted credentials stored in the `credentials` table.

- [ ] **Step 3: Verify build**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add packages/vault/ apps/dashboard/
git commit -m "feat: add encrypted credential vault (AES-256-GCM)"
```

---

### Task 8: Audit Logging System

**Files:**
- Create: `apps/dashboard/src/lib/audit.ts`
- Modify: existing API routes to log actions

- [ ] **Step 1: Create audit logging utility**

```typescript
import { createDb, auditLog } from "@durandal/db";
import { config } from "./config";

function getDb() {
  return createDb(config.databaseUrl.replace("file:", ""));
}

export function logAudit(entry: {
  actor: string;
  action: string;
  resource: string;
  details?: string;
}) {
  const db = getDb();
  db.insert(auditLog).values({
    id: crypto.randomUUID(),
    timestamp: new Date(),
    actor: entry.actor,
    action: entry.action,
    resource: entry.resource,
    details: entry.details ?? null,
  }).run();
}
```

- [ ] **Step 2: Add audit logging to key API routes**

Add `logAudit()` calls to:
- Task creation (POST /api/tasks)
- Task cancellation (DELETE /api/tasks/:id)
- Memory updates (PUT /api/memory)
- User creation (POST /api/setup)
- Credential changes
- Login events (in Auth.js callbacks)

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/
git commit -m "feat(dashboard): add audit logging to all API routes"
```

---

### Task 9: Container Security Hardening

**Files:**
- Modify: `vendors/nanoclaw/src/container-runner.ts` or `api.ts`
- Modify: `docker/docker-compose.yml`

- [ ] **Step 1: Read NanoClaw's container runner**

Read `vendors/nanoclaw/src/container-runner.ts` to see how Docker containers are spawned. Look for the `docker run` args.

- [ ] **Step 2: Add security flags to container spawning**

Ensure these flags are added to every container spawn:
- `--cap-drop ALL` — drop all Linux capabilities
- `--security-opt no-new-privileges` — prevent privilege escalation
- `--pids-limit 128` — limit process count
- `--memory 512m` — limit RAM
- `--cpus 0.5` — limit CPU
- `--network none` — no network by default
- `--read-only` — read-only root filesystem (with tmpfs for /tmp)
- `--tmpfs /tmp:rw,noexec,nosuid,size=256m`

Check if NanoClaw already adds some of these. Only add what's missing.

- [ ] **Step 3: Harden the compose services**

Add to `docker/docker-compose.yml` for the nanoclaw and hermes services:
```yaml
security_opt:
  - no-new-privileges:true
cap_drop:
  - ALL
```

- [ ] **Step 4: Commit**

```bash
git add vendors/nanoclaw/ docker/
git commit -m "feat(security): harden container isolation with capability dropping and resource limits"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Full build**

Run: `pnpm build`

- [ ] **Step 2: Lint**

Run: `pnpm lint`

- [ ] **Step 3: Docker compose validation**

Run: `cd docker && docker compose config --quiet`

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix: Phase 2 final verification fixes"
```

---

## Phase 2 Completion Checklist

- [ ] Auth system works (login page, session management, JWT)
- [ ] Setup wizard creates first Owner account
- [ ] RBAC enforced on API routes (Owner > Admin > Member)
- [ ] Dashboard has sidebar navigation with 5 pages
- [ ] Tasks page shows table of all tasks
- [ ] Agents page shows editable memory
- [ ] Audit log page shows all logged actions
- [ ] Settings page with user management + credentials
- [ ] Credential vault encrypts API keys at rest
- [ ] Audit logging on all sensitive API actions
- [ ] Container security flags applied (cap-drop, no-new-privileges, resource limits)
- [ ] `pnpm build` passes
- [ ] `docker compose config` validates
