export const config = {
  hermesUrl: process.env.HERMES_URL ?? "http://localhost:8642",
  nanoclawUrl: process.env.NANOCLAW_URL ?? "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL ?? "file:durandal.db",
  nextAuthSecret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
} as const;
