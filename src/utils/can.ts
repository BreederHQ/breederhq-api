// src/utils/can.ts
// Centralized capability evaluator for RBAC.
//
// Usage:
//   import { can } from "../utils/can.js";
//   if (!can(membership.role, "breeding.edit")) return reply.code(403)...

import { ROLE_PERMISSIONS } from "../config/permissions.config.js";

/**
 * Check whether a given role grants a specific capability.
 *
 * Wildcard rules:
 *   '*'          → matches any capability
 *   'animals.*'  → matches 'animals.view', 'animals.edit', 'animals.delete', etc.
 *   'health.record' → matches only 'health.record'
 *
 * @param role       TenantRole string (e.g. "ADMIN", "BARN_STAFF")
 * @param capability Dot-delimited capability (e.g. "breeding.edit")
 * @returns true if the role grants the capability
 */
export function can(role: string, capability: string): boolean {
  const caps = ROLE_PERMISSIONS[role];
  if (!caps) return false;

  for (const cap of caps) {
    // Universal wildcard
    if (cap === "*") return true;

    // Exact match
    if (cap === capability) return true;

    // Namespace wildcard: 'animals.*' matches any 'animals.<action>'
    if (cap.endsWith(".*")) {
      const ns = cap.slice(0, -2); // 'animals'
      if (capability === ns || capability.startsWith(ns + ".")) {
        return true;
      }
    }
  }

  return false;
}
