export interface DriveFolder {
  id: string;
  name: string;
  parent_id: string;
  created_by: string;
}

export interface DriveFile {
  id: string;
  name: string;
  folder_id: string;
  storage_path: string;
  content_type: string;
  size: number;
  status: 'pending' | 'ready';
  created_by: string;
}
