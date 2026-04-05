/**
 * DURANDAL License Verification (Server-only)
 *
 * RSA-SHA256 signature verification using Node.js crypto.
 * This module MUST only be imported in server-side code (API routes,
 * server components, scripts) — never in client bundles.
 */

import { createVerify } from "node:crypto";
import type { LicensePayload, LicenseResult } from "./license";

// ── RSA public key (2048-bit, development) ──────────────────────────
const RSA_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3o64xXoXCFtBkeWGzzt3
v8vv+ACKDbj/8I4RdHK9p1ykTW2Jz+0knzm6XsBRX3D/oqktq3aCA2YQFGiXPIMv
eErJxSbK1VdDV6q1JNTMaJHl84YLL1QRRGiJ1woc4LqdeCz1ndBuVMGCZsNCqklS
21L5iKxnapZA5TP6hVuSvzXnOxk2Htdij8AwFfY4iJZFtRCTMNbjvLIMs5l3rhDU
3lh+J59osaZF7I7EC8A4oO6VSvDFlYJJX0JwcdqhSgNDS5CLOZJusgmOEcqHN7CW
kUpHGtXE7mmnOqwm5N8JuQ+2itg838PEPd7jTS57CbkwqANFWhulvAR+xP/mrbyW
JwIDAQAB
-----END PUBLIC KEY-----`;

/**
 * Validate a license key string.
 *
 * Format: `base64(JSON payload):base64(RSA-SHA256 signature)`
 */
export function validateLicense(licenseKey: string): LicenseResult {
  try {
    const parts = licenseKey.split(":");
    if (parts.length !== 2) {
      return { valid: false, error: "Invalid license key format" };
    }

    const [payloadB64, signatureB64] = parts;

    // Decode payload
    const payloadJson = Buffer.from(payloadB64, "base64").toString("utf-8");
    let payload: LicensePayload;
    try {
      payload = JSON.parse(payloadJson) as LicensePayload;
    } catch {
      return { valid: false, error: "Invalid license payload" };
    }

    // Verify RSA-SHA256 signature
    const verifier = createVerify("RSA-SHA256");
    verifier.update(payloadB64);
    verifier.end();

    const signatureValid = verifier.verify(
      RSA_PUBLIC_KEY,
      signatureB64,
      "base64",
    );

    if (!signatureValid) {
      return { valid: false, error: "Invalid license signature" };
    }

    // Check required fields
    if (!payload.tier || !payload.expiresAt || !payload.orgName) {
      return { valid: false, error: "License payload missing required fields" };
    }

    // Check expiry
    const expiresAt = new Date(payload.expiresAt);
    if (isNaN(expiresAt.getTime())) {
      return { valid: false, error: "Invalid expiry date" };
    }
    if (expiresAt < new Date()) {
      return { valid: false, error: "License has expired" };
    }

    // Validate tier
    if (!["community", "pro", "enterprise"].includes(payload.tier)) {
      return { valid: false, error: `Unknown license tier: ${payload.tier}` };
    }

    return { valid: true, payload };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { valid: false, error: `License validation failed: ${message}` };
  }
}
