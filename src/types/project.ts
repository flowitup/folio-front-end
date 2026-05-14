export interface Project {
  id: string;
  name: string;
  address: string | null;
  owner_id: string;
  user_count: number;
  created_at: string;
  /** UUID of the company this project belongs to. Null/undefined if no company is linked. */
  company_id?: string | null;
}

export interface ProjectListResponse {
  projects: Project[];
  total: number;
}

export interface ProjectUser {
  id: string;
  email: string;
}

export interface ProjectUsersResponse {
  users: ProjectUser[];
  total: number;
}
