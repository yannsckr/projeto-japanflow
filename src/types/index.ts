export type UserRole = 'admin' | 'employee';

export type Priority = 'high' | 'medium' | 'low';

export type TaskStatus = 'todo' | 'in_progress' | 'paused' | 'done';

export type Sector =
  | 'vendas'
  | 'expedicao'
  | 'motoboys'
  | 'site'
  | 'compras'
  | 'estoque'
  | 'financeiro'
  | 'administracao'
  | 'garantias';

export const SECTOR_LABELS: Record<Sector, string> = {
  vendas: 'Vendas',
  expedicao: 'Expedição',
  motoboys: 'Motoboys',
  site: 'Site',
  compras: 'Compras',
  estoque: 'Estoque',
  financeiro: 'Financeiro',
  administracao: 'Administração',
  garantias: 'Garantias',
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'A Fazer',
  in_progress: 'Em Andamento',
  paused: 'Em Pausa',
  done: 'Concluído',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export interface User {
  id: string;
  name: string;
  username: string;
  password: string;
  role: UserRole;
  avatar?: string;
  sectors: Sector[];
  function?: string;
  backgroundColor?: string;
}

export interface StatusHistoryEntry {
  status: TaskStatus;
  enteredAt: string;
  exitedAt?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string;
  createdBy: string;
  deadline: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusHistoryEntry[];
  sector?: Sector;
  imageUrl?: string;
  imageUrls?: string[];
  response?: string;
}

export type CalendarTargetMode = 'all' | 'sector' | 'specific';

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  userId: string;
  createdBy: string;
  type: 'reminder' | 'event';
  targetMode: CalendarTargetMode;
  targetUsers: string[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId?: string;
  taskId?: string;
  groupId?: string;
  content: string;
  timestamp: string;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'file' | 'audio';
  attachmentName?: string;
  edited?: boolean;
  deleted?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  timestamp: string;
  type: 'task_created' | 'task_updated' | 'priority_changed' | 'new_message';
}
