export interface LaborRole {
  id: string;
  name: string;
  color: string;
  created_at: string;
  /**
   * Stable cross-company key for the two seeded default roles (e.g.
   * "tho_chinh"). Optional — the backend rollout may not populate it on
   * every environment yet; `resolveDefaultRoleI18nKey` (default-role-names.ts)
   * falls back to the literal seed name when it's absent.
   */
  slug?: string | null;
}

export interface CreateLaborRolePayload {
  name: string;
  color: string;
}

export interface UpdateLaborRolePayload {
  name?: string;
  color?: string;
}

export interface LaborRoleListResponse {
  roles: LaborRole[];
  palette: string[];
}
