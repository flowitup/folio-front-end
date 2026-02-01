export interface Project {
  id: string;
  name: string;
  address: string | null;
  owner_id: string;
  user_count: number;
  created_at: string;
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
