/**
 * DURANDAL License Types & Tier Limits
 *
 * This module contains ONLY pure TypeScript types and constants with
 * no Node.js dependencies, so it can be safely imported in both
 * client and server contexts.
 *
 * For RSA signature validation, use `validateLicense` from
 * `@durandal/core/license-verify` (server-only).
 */

// ── Types ────────────────────────────────────────────────────────────

export type LicenseTier = "community" | "pro" | "enterprise";

export interface LicensePayload {
  tier: LicenseTier;
  maxUsers: number;
  maxTemplates: number;
  orgName: string;
  features: string[];
  issuedAt: string;  // ISO date
  expiresAt: string; // ISO date
}

export interface LicenseResult {
  valid: boolean;
  payload?: LicensePayload;
  error?: string;
}

export interface FeatureLimits {
  maxUsers: number;
  maxTemplates: number;
  ssoEnabled: boolean;
  cloudLlm: boolean;
  prioritySupport: boolean;
}

// ── Tier defaults ────────────────────────────────────────────────────

const TIER_LIMITS: Record<LicenseTier, FeatureLimits> = {
  community: {
    maxUsers: 3,
    maxTemplates: 10,
    ssoEnabled: false,
    cloudLlm: false,
    prioritySupport: false,
  },
  pro: {
    maxUsers: 25,
    maxTemplates: 100,
    ssoEnabled: true,
    cloudLlm: true,
    prioritySupport: false,
  },
  enterprise: {
    maxUsers: Infinity,
    maxTemplates: Infinity,
    ssoEnabled: true,
    cloudLlm: true,
    prioritySupport: true,
  },
};

/**
 * Return feature limits for a given license tier.
 */
export function getFeatureLimits(tier: LicenseTier): FeatureLimits {
  return TIER_LIMITS[tier] ?? TIER_LIMITS.community;
}
