# Phase 0: Project Setup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the DURANDAL monorepo with working builds, vendor integration (Hermes Agent + NanoClaw via git subtree), Docker Compose for all 5 services, CI pipeline, and license compliance.

**Architecture:** pnpm monorepo with Turborepo for build orchestration. Two upstream repos (Hermes Agent, NanoClaw) pulled as git subtrees under `vendors/`. Five Docker services (dashboard, hermes, nanoclaw, ollama, caddy) on an internal bridge network. GitHub Actions for CI.

**Tech Stack:** pnpm 10.x, Turborepo, TypeScript 5.x, Next.js 15, Python 3.11+, Docker Compose v2, GitHub Actions

**Spec Reference:** `docs/superpowers/specs/2026-04-05-durandal-platform-design.md` — Phase 0 (Section 5)

---

## File Structure

```
durandal/
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI: lint, typecheck, build, Docker
├── apps/
│   └── dashboard/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx        # Root layout
│       │   │   └── page.tsx          # Home page (placeholder)
│       │   └── lib/
│       │       └── config.ts         # Environment config
│       ├── public/
│       │   └── favicon.ico
│       ├── next.config.ts            # Next.js config
│       ├── tailwind.config.ts        # Tailwind config
│       ├── tsconfig.json             # Dashboard TS config
│       └── package.json              # Dashboard deps
├── packages/
│   ├── core/
│   │   ├── src/
│   │   │   └── index.ts             # Shared types + constants
│   │   ├── tsconfig.json
│   │   └── package.json
│   ├── db/
│   │   ├── src/
│   │   │   ├── index.ts             # DB client + schema exports
│   │   │   ├── schema.ts            # Drizzle schema
│   │   │   └── migrate.ts           # Migration runner
│   │   ├── drizzle/                  # Generated migrations
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── tsconfig/
│       ├── base.json                 # Shared TS base config
│       ├── nextjs.json               # Next.js TS config
│       ├── library.json              # Library TS config
│       └── package.json
├── vendors/
│   ├── hermes-agent/                 # Git subtree
│   └── nanoclaw/                     # Git subtree
├── docker/
│   ├── Dockerfile.dashboard
│   ├── Dockerfile.hermes
│   ├── Dockerfile.nanoclaw
│   ├── Caddyfile
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── .env.example
├── LICENSES/
│   ├── MIT-hermes-agent.txt
│   ├── MIT-nanoclaw.txt
│   ├── NOTICE.md
│   └── DURANDAL-BSL.md
├── .gitignore
├── .eslintrc.cjs
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

---

### Task 1: Initialize pnpm Monorepo

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.npmrc`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "durandal",
  "private": true,
  "version": "0.1.0",
  "description": "Your unbreakable AI workforce. Runs local. Stays private. Gets smarter.",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.7.0"
  },
  "packageManager": "pnpm@10.8.0",
  "engines": {
    "node": ">=22.0.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 4: Create .gitignore**

```gitignore
# dependencies
node_modules/
.pnpm-store/

# build
.next/
dist/
.turbo/
out/

# env
.env
.env.local
.env.*.local

# os
.DS_Store
Thumbs.db

# ide
.vscode/
.idea/
*.swp

# python
__pycache__/
*.pyc
.venv/
*.egg-info/

# docker
docker/data/

# superpowers
.superpowers/

# misc
*.log
```

- [ ] **Step 5: Create .npmrc**

```ini
auto-install-peers=true
strict-peer-dependencies=false
```

- [ ] **Step 6: Install dependencies and verify**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL && pnpm install`
Expected: lockfile created, no errors

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .gitignore .npmrc pnpm-lock.yaml
git commit -m "feat: initialize pnpm monorepo with Turborepo"
```

---

### Task 2: Create Shared TypeScript Configs

**Files:**
- Create: `packages/tsconfig/package.json`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nextjs.json`
- Create: `packages/tsconfig/library.json`

- [ ] **Step 1: Create tsconfig package.json**

```json
{
  "name": "@durandal/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": [
    "base.json",
    "nextjs.json",
    "library.json"
  ]
}
```

- [ ] **Step 2: Create base.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "lib": ["ES2022"],
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create nextjs.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noEmit": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 4: Create library.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/tsconfig/
git commit -m "feat: add shared TypeScript configs"
```

---

### Task 3: Create @durandal/core Package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@durandal/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist"
  },
  "devDependencies": {
    "@durandal/tsconfig": "workspace:*",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@durandal/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/index.ts with core types**

```typescript
// DURANDAL Core Types & Constants

export const DURANDAL_VERSION = "0.1.0";

export const HERMES_DEFAULT_PORT = 8642;
export const NANOCLAW_DEFAULT_PORT = 3000;
export const DASHBOARD_DEFAULT_PORT = 3001;

/** Task status lifecycle */
export type TaskStatus =
  | "pending"
  | "planning"
  | "executing"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

/** RBAC roles — Owner > Admin > Member */
export type UserRole = "owner" | "admin" | "member";

/** Agent task submitted via the dashboard */
export interface Task {
  id: string;
  templateId: string | null;
  status: TaskStatus;
  input: string;
  output: string | null;
  error: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** User account */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/** Audit log entry */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  resource: string;
  details: string | null;
}

/** Template definition (loaded from YAML) */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: TemplateStep[];
  requiredCredentials: string[];
  networkAllowlist: string[];
  schedule: string | null;
}

export interface TemplateStep {
  name: string;
  tool: string;
  params: Record<string, unknown>;
  requiresApproval: boolean;
}

/** Health check response */
export interface HealthStatus {
  service: string;
  status: "healthy" | "unhealthy" | "starting";
  version: string;
  uptime: number;
}
```

- [ ] **Step 4: Install deps and typecheck**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL && pnpm install && pnpm --filter @durandal/core typecheck`
Expected: no type errors

- [ ] **Step 5: Commit**

```bash
git add packages/core/
git commit -m "feat: add @durandal/core package with shared types"
```

---

### Task 4: Create @durandal/db Package

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/index.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/drizzle.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@durandal/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf dist",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/migrate.ts"
  },
  "dependencies": {
    "better-sqlite3": "^11.7.0",
    "drizzle-orm": "^0.39.0",
    "@durandal/core": "workspace:*"
  },
  "devDependencies": {
    "@durandal/tsconfig": "workspace:*",
    "@types/better-sqlite3": "^7.6.12",
    "drizzle-kit": "^0.30.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@durandal/tsconfig/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create src/schema.ts**

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["owner", "admin", "member"] })
    .notNull()
    .default("member"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  templateId: text("template_id"),
  status: text("status", {
    enum: [
      "pending",
      "planning",
      "executing",
      "awaiting_approval",
      "completed",
      "failed",
      "cancelled",
    ],
  })
    .notNull()
    .default("pending"),
  input: text("input").notNull(),
  output: text("output"),
  error: text("error"),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  details: text("details"),
});

export const credentials = sqliteTable("credentials", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  service: text("service").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  iv: text("iv").notNull(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

- [ ] **Step 4: Create src/index.ts**

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export * from "./schema.js";

export function createDb(dbPath: string) {
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export type DurandalDb = ReturnType<typeof createDb>;
```

- [ ] **Step 5: Create src/migrate.ts**

```typescript
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createDb } from "./index.js";

const DB_PATH = process.env.DATABASE_URL?.replace("file:", "") ?? "durandal.db";

const db = createDb(DB_PATH);
migrate(db, { migrationsFolder: "./drizzle" });

console.log("Migrations complete.");
```

- [ ] **Step 6: Create drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:durandal.db",
  },
});
```

- [ ] **Step 7: Install deps and typecheck**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL && pnpm install && pnpm --filter @durandal/db typecheck`
Expected: no type errors

- [ ] **Step 8: Generate initial migration**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL/packages/db && pnpm db:generate`
Expected: migration SQL files created in `drizzle/` directory

- [ ] **Step 9: Commit**

```bash
git add packages/db/
git commit -m "feat: add @durandal/db package with Drizzle schema and SQLite"
```

---

### Task 5: Scaffold Next.js Dashboard App

**Files:**
- Create: `apps/dashboard/package.json`
- Create: `apps/dashboard/next.config.ts`
- Create: `apps/dashboard/tsconfig.json`
- Create: `apps/dashboard/tailwind.config.ts`
- Create: `apps/dashboard/postcss.config.js`
- Create: `apps/dashboard/src/app/globals.css`
- Create: `apps/dashboard/src/app/layout.tsx`
- Create: `apps/dashboard/src/app/page.tsx`
- Create: `apps/dashboard/src/lib/config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@durandal/dashboard",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start --port 3001",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "clean": "rm -rf .next"
  },
  "dependencies": {
    "@durandal/core": "workspace:*",
    "@durandal/db": "workspace:*",
    "next": "^15.3.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@durandal/tsconfig": "workspace:*",
    "@tailwindcss/postcss": "^4.1.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "@durandal/tsconfig/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@durandal/core", "@durandal/db"],
  output: "standalone",
};

export default nextConfig;
```

- [ ] **Step 4: Create postcss.config.js**

```javascript
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

- [ ] **Step 5: Create tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Create src/app/globals.css**

```css
@import "tailwindcss";
```

- [ ] **Step 7: Create src/lib/config.ts**

```typescript
export const config = {
  hermesUrl: process.env.HERMES_URL ?? "http://localhost:8642",
  nanoclawUrl: process.env.NANOCLAW_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL ?? "file:durandal.db",
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
} as const;
```

- [ ] **Step 8: Create src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DURANDAL",
  description:
    "Your unbreakable AI workforce. Runs local. Stays private. Gets smarter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 9: Create src/app/page.tsx**

```tsx
import { DURANDAL_VERSION } from "@durandal/core";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-5xl font-bold tracking-wider mb-4 bg-gradient-to-r from-orange-500 to-yellow-500 bg-clip-text text-transparent">
        DURANDAL
      </h1>
      <p className="text-gray-400 text-lg mb-2">
        Your unbreakable AI workforce.
      </p>
      <p className="text-gray-600 text-sm">v{DURANDAL_VERSION}</p>
    </main>
  );
}
```

- [ ] **Step 10: Install deps and verify build**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL && pnpm install && pnpm --filter @durandal/dashboard build`
Expected: Next.js builds successfully, `.next/` directory created

- [ ] **Step 11: Commit**

```bash
git add apps/dashboard/
git commit -m "feat: scaffold Next.js dashboard app with Tailwind"
```

---

### Task 6: Add ESLint Configuration

**Files:**
- Create: `.eslintrc.cjs`
- Modify: `package.json` (add eslint devDep)
- Modify: `apps/dashboard/package.json` (add eslint deps)

- [ ] **Step 1: Create root .eslintrc.cjs**

```javascript
/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  extends: ["eslint:recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    ".turbo/",
    "vendors/",
    "drizzle/",
  ],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
      ],
      rules: {
        "@typescript-eslint/no-unused-vars": [
          "error",
          { argsIgnorePattern: "^_" },
        ],
      },
    },
  ],
};
```

- [ ] **Step 2: Add eslint devDeps to root package.json**

Add to root `package.json` devDependencies:
```json
{
  "devDependencies": {
    "eslint": "^9.20.0",
    "@typescript-eslint/parser": "^8.25.0",
    "@typescript-eslint/eslint-plugin": "^8.25.0",
    "turbo": "^2.5.0",
    "typescript": "^5.7.0"
  }
}
```

Also add lint script for dashboard in `apps/dashboard/package.json` — already present from Task 5 (`"lint": "next lint"`).

- [ ] **Step 3: Install and run lint**

Run: `cd /Users/hamzanaeem/Projects/DURANDAL && pnpm install && pnpm lint`
Expected: lint passes with no errors

- [ ] **Step 4: Commit**

```bash
git add .eslintrc.cjs package.json pnpm-lock.yaml
git commit -m "feat: add ESLint configuration"
```

---

### Task 7: Integrate Vendor Repos via Git Subtree

**Files:**
- Create: `vendors/hermes-agent/` (via git subtree)
- Create: `vendors/nanoclaw/` (via git subtree)

- [ ] **Step 1: Add Hermes Agent as git subtree**

Run:
```bash
cd /Users/hamzanaeem/Projects/DURANDAL
git remote add hermes-upstream https://github.com/NousResearch/hermes-agent.git
git fetch hermes-upstream main
git subtree add --prefix=vendors/hermes-agent hermes-upstream main --squash
```
Expected: `vendors/hermes-agent/` populated with Hermes source. Commit created automatically by git subtree.

- [ ] **Step 2: Add NanoClaw as git subtree**

Run:
```bash
cd /Users/hamzanaeem/Projects/DURANDAL
git remote add nanoclaw-upstream https://github.com/qwibitai/nanoclaw.git
git fetch nanoclaw-upstream main
git subtree add --prefix=vendors/nanoclaw nanoclaw-upstream main --squash
```
Expected: `vendors/nanoclaw/` populated with NanoClaw source. Commit created automatically by git subtree.

- [ ] **Step 3: Verify vendor files exist**

Run:
```bash
ls vendors/hermes-agent/run_agent.py && echo "Hermes OK"
ls vendors/nanoclaw/src/index.ts && echo "NanoClaw OK"
```
Expected: both files found, both "OK" printed

- [ ] **Step 4: Document subtree update commands**

Create `vendors/README.md`:

```markdown
# Vendor Dependencies

These directories are managed via `git subtree`. Do not clone or init submodules.

## Updating vendors

```bash
# Update Hermes Agent
git subtree pull --prefix=vendors/hermes-agent hermes-upstream main --squash

# Update NanoClaw
git subtree pull --prefix=vendors/nanoclaw nanoclaw-upstream main --squash
```

## Remotes

```bash
git remote add hermes-upstream https://github.com/NousResearch/hermes-agent.git
git remote add nanoclaw-upstream https://github.com/qwibitai/nanoclaw.git
```
```

- [ ] **Step 5: Commit README**

```bash
git add vendors/README.md
git commit -m "docs: add vendor subtree update instructions"
```

---

### Task 8: License Compliance

**Files:**
- Create: `LICENSES/MIT-hermes-agent.txt`
- Create: `LICENSES/MIT-nanoclaw.txt`
- Create: `LICENSES/NOTICE.md`
- Create: `LICENSES/DURANDAL-BSL.md`

- [ ] **Step 1: Copy Hermes Agent MIT license**

Run:
```bash
mkdir -p /Users/hamzanaeem/Projects/DURANDAL/LICENSES
cp vendors/hermes-agent/LICENSE LICENSES/MIT-hermes-agent.txt
```

If `vendors/hermes-agent/LICENSE` doesn't exist, check for `LICENSE.md` or `COPYING`. Create the file with the MIT license text and the NousResearch copyright from the repo.

- [ ] **Step 2: Copy NanoClaw MIT license**

Run:
```bash
cp vendors/nanoclaw/LICENSE LICENSES/MIT-nanoclaw.txt
```

Same fallback as above — check for `LICENSE.md` or `COPYING`.

- [ ] **Step 3: Create NOTICE.md**

```markdown
# DURANDAL — Open Source Attribution

DURANDAL incorporates the following open-source projects:

## Hermes Agent

- **Repository:** https://github.com/NousResearch/hermes-agent
- **License:** MIT
- **Copyright:** See LICENSES/MIT-hermes-agent.txt

## NanoClaw

- **Repository:** https://github.com/qwibitai/nanoclaw
- **License:** MIT
- **Copyright:** See LICENSES/MIT-nanoclaw.txt

---

The full text of each license is included in the LICENSES/ directory
of this distribution. These notices must be preserved in all copies
and distributions of DURANDAL.
```

- [ ] **Step 4: Create DURANDAL-BSL.md placeholder**

```markdown
# Business Source License 1.1

Licensor: [Your Company Name]
Licensed Work: DURANDAL Premium Features
Additional Use Grant: None
Change Date: 2029-04-05
Change License: MIT

## Terms

The Licensed Work is provided under the terms of the Business Source
License 1.1 as published at https://mariadb.com/bsl11/

The following features are covered by this license:
- SSO integration (OIDC/SAML)
- Multi-user RBAC (beyond single user)
- Managed GCP hosting integration
- Priority support tooling

The core DURANDAL platform remains MIT-licensed.
See LICENSES/MIT-hermes-agent.txt and LICENSES/MIT-nanoclaw.txt
for upstream component licenses.

On the Change Date, the Licensed Work will be made available
under the MIT License.
```

- [ ] **Step 5: Commit**

```bash
git add LICENSES/
git commit -m "feat: add license compliance files (MIT attribution + BSL)"
```

---

### Task 9: Docker Compose Stack

**Files:**
- Create: `docker/Dockerfile.dashboard`
- Create: `docker/Dockerfile.hermes`
- Create: `docker/Dockerfile.nanoclaw`
- Create: `docker/docker-compose.yml`
- Create: `docker/docker-compose.dev.yml`
- Create: `docker/Caddyfile`
- Create: `docker/.env.example`

- [ ] **Step 1: Create Dockerfile.dashboard**

```dockerfile
FROM node:22-slim AS base
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/dashboard/node_modules ./apps/dashboard/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .
RUN pnpm --filter @durandal/dashboard build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/dashboard/server.js"]
```

- [ ] **Step 2: Create Dockerfile.hermes**

```dockerfile
FROM python:3.12-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl git && \
    rm -rf /var/lib/apt/lists/*

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app
COPY vendors/hermes-agent/ .

RUN uv sync --frozen 2>/dev/null || uv sync

# Create data directory
RUN mkdir -p /data/hermes

ENV HERMES_DATA=/data/hermes
EXPOSE 8642

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8642/health || exit 1

CMD ["uv", "run", "hermes", "serve", "--host", "0.0.0.0", "--port", "8642"]
```

- [ ] **Step 3: Create Dockerfile.nanoclaw**

```dockerfile
FROM node:22-slim AS base

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl docker.io && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app
COPY vendors/nanoclaw/ .

RUN pnpm install --frozen-lockfile 2>/dev/null || npm install

RUN mkdir -p /data/nanoclaw

ENV DURANDAL_MODE=executor
EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "src/index.ts"]
```

- [ ] **Step 4: Create Caddyfile**

```
{
	admin off
}

:443 {
	tls internal

	reverse_proxy /api/* dashboard:3001
	reverse_proxy /_next/* dashboard:3001
	reverse_proxy dashboard:3001
}

:80 {
	redir https://{host}{uri} permanent
}
```

- [ ] **Step 5: Create docker-compose.yml**

```yaml
services:
  dashboard:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dashboard
    environment:
      - DATABASE_URL=file:/data/durandal.db
      - HERMES_URL=http://hermes:8642
      - NANOCLAW_URL=http://nanoclaw:3000
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-change-me-in-production}
    volumes:
      - durandal-data:/data
    depends_on:
      hermes:
        condition: service_healthy
      nanoclaw:
        condition: service_healthy
    networks:
      - durandal-internal
    restart: unless-stopped

  hermes:
    build:
      context: ..
      dockerfile: docker/Dockerfile.hermes
    environment:
      - OLLAMA_HOST=http://ollama:11434
      - HERMES_DATA=/data/hermes
    volumes:
      - durandal-data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8642/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 30s
    networks:
      - durandal-internal
    restart: unless-stopped

  nanoclaw:
    build:
      context: ..
      dockerfile: docker/Dockerfile.nanoclaw
    environment:
      - DURANDAL_MODE=executor
    volumes:
      - durandal-data:/data
      - /var/run/docker.sock:/var/run/docker.sock
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 15s
    networks:
      - durandal-internal
    restart: unless-stopped

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama-models:/root/.ollama
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    networks:
      - durandal-internal
    restart: unless-stopped
    # Uncomment for GPU passthrough:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - capabilities: [gpu]

  caddy:
    image: caddy:2-alpine
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
      - caddy-config:/config
    depends_on:
      - dashboard
    networks:
      - durandal-internal
    restart: unless-stopped

volumes:
  durandal-data:
    name: durandal-data
  ollama-models:
    name: durandal-ollama-models
  caddy-data:
    name: durandal-caddy-data
  caddy-config:
    name: durandal-caddy-config

networks:
  durandal-internal:
    driver: bridge
```

- [ ] **Step 6: Create docker-compose.dev.yml**

```yaml
services:
  dashboard:
    build:
      context: ..
      dockerfile: docker/Dockerfile.dashboard
      target: deps
    command: pnpm --filter @durandal/dashboard dev
    volumes:
      - ../apps/dashboard/src:/app/apps/dashboard/src
      - ../packages:/app/packages
    ports:
      - "3001:3001"

  hermes:
    healthcheck:
      start_period: 60s
    ports:
      - "8642:8642"

  nanoclaw:
    ports:
      - "3000:3000"

  caddy:
    profiles:
      - with-caddy
```

- [ ] **Step 7: Create .env.example**

```bash
# DURANDAL Environment Configuration
# Copy to .env and fill in values: cp .env.example .env

# Required: Generate a random secret for session encryption
# Run: openssl rand -base64 32
NEXTAUTH_SECRET=change-me-in-production

# Optional: Cloud LLM API keys (leave empty for local-only mode)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_AI_API_KEY=

# Optional: Ollama model to pull on first start (default: qwen2.5:7b)
OLLAMA_DEFAULT_MODEL=qwen2.5:7b
```

- [ ] **Step 8: Verify compose config is valid**

Run:
```bash
cd /Users/hamzanaeem/Projects/DURANDAL/docker && docker compose config --quiet
```
Expected: no errors (validates YAML structure and service definitions)

- [ ] **Step 9: Commit**

```bash
git add docker/
git commit -m "feat: add Docker Compose stack (dashboard, hermes, nanoclaw, ollama, caddy)"
```

---

### Task 10: GitHub Actions CI Pipeline

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

  build:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

  docker:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build dashboard image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: docker/Dockerfile.dashboard
          push: false
          tags: durandal/dashboard:dev
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "feat: add GitHub Actions CI pipeline (lint, typecheck, build, docker)"
```

---

### Task 11: Root README and Final Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Create README.md**

```markdown
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
```

- [ ] **Step 2: Run full build from root**

Run:
```bash
cd /Users/hamzanaeem/Projects/DURANDAL && pnpm install && pnpm build
```
Expected: all packages build successfully

- [ ] **Step 3: Run lint from root**

Run:
```bash
cd /Users/hamzanaeem/Projects/DURANDAL && pnpm lint
```
Expected: no lint errors

- [ ] **Step 4: Verify docker compose config**

Run:
```bash
cd /Users/hamzanaeem/Projects/DURANDAL/docker && docker compose config --quiet
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add project README with quick start guide"
```

---

## Phase 0 Completion Checklist

After all tasks are done, verify these acceptance criteria from the spec:

- [ ] `pnpm build` succeeds from root, all packages resolve
- [ ] Both upstream repos pulled via git subtree, vendor files present
- [ ] `docker compose config` validates without errors in `docker/`
- [ ] CI workflow file exists at `.github/workflows/ci.yml`
- [ ] LICENSES/ directory contains MIT texts for both upstream repos + NOTICE + BSL
- [ ] README.md exists with quick start instructions
