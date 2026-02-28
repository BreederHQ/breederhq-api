// src/config/permissions.config.ts
// Centralized RBAC permission configuration
//
// Maps each TenantRole to a set of capability strings.
// Capabilities use dot-delimited namespaces with optional wildcards:
//   '*'           → grants everything
//   'animals.*'   → grants any capability starting with 'animals.'
//   'health.record' → grants only 'health.record'

export type PermissionCapability = string;

/**
 * Role → capabilities mapping.
 * Mirrors the frontend config in @bhq/types/permissions.config.ts.
 */
export const ROLE_PERMISSIONS: Record<string, PermissionCapability[]> = {
  OWNER:          ["*"],
  ADMIN:          ["animals.*", "breeding.*", "health.*", "finance.*", "contacts.*", "staff.*"],
  MANAGER:        ["animals.*", "breeding.*", "health.*", "finance.view", "contacts.*", "staff.view"],
  BREEDING_STAFF: ["animals.view", "breeding.*", "health.record", "contacts.view"],
  BARN_STAFF:     ["animals.view", "health.record"],
  FINANCE:        ["finance.*", "contacts.view"],
  VIEWER:         ["animals.view", "breeding.view"],
  // Legacy aliases
  MEMBER:         ["animals.*", "breeding.*", "health.*", "finance.view", "contacts.*", "staff.view"],
  BILLING:        ["finance.*", "contacts.view"],
};

/**
 * Roles that see ALL tenant data (no resource-level scoping).
 * Scoped roles (BREEDING_STAFF, BARN_STAFF, FINANCE, VIEWER, BILLING)
 * only see resources they are explicitly assigned to.
 */
export const UNSCOPED_ROLES = ["OWNER", "ADMIN", "MANAGER", "MEMBER"] as const;
