export interface LaborRole {
  id: string;
  name: string;
  color: string;
  created_at: string;
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
