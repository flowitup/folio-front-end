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
