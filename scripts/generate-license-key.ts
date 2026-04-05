#!/usr/bin/env tsx
/**
 * DURANDAL — Internal license key generator
 *
 * Usage:
 *   pnpm tsx scripts/generate-license-key.ts --tier pro --org "Acme Corp" --expires 2027-01-01
 *
 * This tool is NOT shipped to end-users. It signs a JSON payload with the
 * private RSA key; the resulting key can be validated offline by the
 * embedded public key in @durandal/core.
 */

import { createSign } from "node:crypto";

// ── RSA private key (development only — NEVER ship this) ────────────
const RSA_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDejrjFehcIW0GR
5YbPO3e/y+/4AIoNuP/wjhF0cr2nXKRNbYnP7SSfObpewFFfcP+iqS2rdoIDZhAU
aJc8gy94SsnFJsrVV0NXqrUk1MxokeXzhgsvVBFEaInXChzgup14LPWd0G5UwYJm
w0KqSVLbUvmIrGdqlkDlM/qFW5K/Nec7GTYe12KPwDAV9jiIlkW1EJMw1uO8sgyz
mXeuENTeWH4nn2ixpkXsjsQLwDig7pVK8MWVgklfQnBx2qFKA0NLkIs5km6yCY4R
yoc3sJaRSkca1cTuaac6rCbk3wm5D7aK2Dzfw8Q93uNNLnsJuTCoA0VaG6W8BH7E
/+atvJYnAgMBAAECggEAQfxg7jQHtjOQWliKQtEn7RbjPE20oOL0B3en1zXZ41BF
aquKi7qM/CSajFNLDRgswyaT4t2NKMLPC64DAS8IGQtbjXe19dEcp1Z2xMfPH0X6
vtxEXrD3OaghDj/yVfMeky4JWNQekkSZjCxijKiWx25vi8VKGEEaVpq1sWp4NPaR
1VbOllyBi5/cZzbQPiUbNTATzT/X8YePDpyDYjyzUfvt6UGu1LOtebKWhni1Xmv9
PyBvSCx2+8f0nl1Ju/YSgo1kfa+0/lbiRs3cUhUhC1Y/cAWTZc6nx3OPnaZiL/uJ
tcBAUI7sV0VhD0skbh4ZJ5RdBLGBR2hyiHZab3N1SQKBgQD0tUrRM9jPFeOAGYEY
NJS+PYOotT7PPh09O8L/HzLrb9H0hsqiJx9lweG8rbOFEYkQQMkN2TyfZ4zWj8rp
WiQHyD5E0Hg9rMi0JcXPTNRKR6adKHe8Wfg5bmdaAVwhkgrQjfBrIIkohac8JnGU
GWVyFTPffv7hEK45ApyzyAjTUwKBgQDo08Qyp13pC3cA+IdQj81JTeatGNO7rZUb
ECGYBdj6JD4ak0DVlOpDobWnxSO4TSYZt02JiVdyqA4hcqFFzNsaQGGi5ZNP1fhy
jm+T6VArPTLMUPm9wUa8GDDW8DY+o+uKeMaXcA7sASFsMsOLvT3KpVcd9cw0Xdim
vYpoj5fLXQKBgQDP0i+qH+gfZy2Amyhh0DYKot9vpg2jn9LhMCHY3Tw3aw3aJ6dr
suIdX11BChwOBOhsnzigxD+R+TVI+3GOYHl9CninpIyZhGYnaHToKw2Xz+YWTknx
8k63J6YqcEE4WXlJyWHG+SjC+08d7GBFMJRRIOSfCJGZvrrXu/otTNMB9QKBgCYv
3YUlWEzJ2ZnqKV94RoZYZZZMdSXaIZOPwMLLarwUR69aKY8eXpH7Ku06c1JeLPqY
yvnc8d/XWoH36CWnpOQYXSs3lkLI6Hf5jqlm4gRFhFhoi52o3q4pFZGbUnpRrmdG
yeO6uGfTA6VYaiQ4RLNBDRnX38dTAR7QBayCqLXtAoGBAMo1eBETTCGAoic20Svl
HLUWHRZjw8N+ATJYWbGqIptK+HEK+zXImr2h3y90y1P7g5//Dy82WF/3u0csXJx7
TKjbsTcB9r/JOvIRhlcAXWHRFGwz0NuMKlvAxdRGf4lYkQEV+2AdaIf/oNwkTjo1
D/r/hii1vZptjuKeNvbPy7Di
-----END PRIVATE KEY-----`;

// ── Tier defaults ────────────────────────────────────────────────────

interface TierDefaults {
  maxUsers: number;
  maxTemplates: number;
  features: string[];
}

const TIER_DEFAULTS: Record<string, TierDefaults> = {
  community: {
    maxUsers: 3,
    maxTemplates: 10,
    features: ["local_llm"],
  },
  pro: {
    maxUsers: 25,
    maxTemplates: 100,
    features: ["local_llm", "cloud_llm", "sso", "priority_templates"],
  },
  enterprise: {
    maxUsers: 999999,
    maxTemplates: 999999,
    features: [
      "local_llm",
      "cloud_llm",
      "sso",
      "priority_templates",
      "priority_support",
      "custom_branding",
      "audit_export",
    ],
  },
};

// ── CLI arg parsing ──────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--") && i + 1 < argv.length) {
      result[arg.slice(2)] = argv[++i];
    }
  }
  return result;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const tier = args.tier;
  const org = args.org;
  const expires = args.expires;

  if (!tier || !org || !expires) {
    console.error(
      "Usage: tsx scripts/generate-license-key.ts --tier <community|pro|enterprise> --org <name> --expires <YYYY-MM-DD>",
    );
    process.exit(1);
  }

  if (!TIER_DEFAULTS[tier]) {
    console.error(`Unknown tier: ${tier}. Must be community, pro, or enterprise.`);
    process.exit(1);
  }

  const expiresDate = new Date(expires);
  if (isNaN(expiresDate.getTime())) {
    console.error(`Invalid date: ${expires}`);
    process.exit(1);
  }

  const defaults = TIER_DEFAULTS[tier];

  const payload = {
    tier,
    maxUsers: defaults.maxUsers,
    maxTemplates: defaults.maxTemplates,
    orgName: org,
    features: defaults.features,
    issuedAt: new Date().toISOString(),
    expiresAt: expiresDate.toISOString(),
  };

  // Encode payload to base64
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");

  // Sign with RSA-SHA256
  const signer = createSign("RSA-SHA256");
  signer.update(payloadB64);
  signer.end();
  const signatureB64 = signer.sign(RSA_PRIVATE_KEY, "base64");

  // License key = payload:signature
  const licenseKey = `${payloadB64}:${signatureB64}`;

  console.log("\n=== DURANDAL License Key ===\n");
  console.log("Tier:      ", tier);
  console.log("Org:       ", org);
  console.log("Expires:   ", expires);
  console.log("Max Users: ", defaults.maxUsers);
  console.log("Max Tmpl:  ", defaults.maxTemplates);
  console.log("Features:  ", defaults.features.join(", "));
  console.log("\n--- License Key (copy everything below) ---\n");
  console.log(licenseKey);
  console.log("\n--- End ---\n");
}

main();
