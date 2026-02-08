export enum Category {
  ALL = 'All',
  WORK = 'Work',
  PERSONAL = 'Personal',
  CREATIVE = 'Creative',
  HEALTH = 'Health',
  FINANCE = 'Finance',
  ADMIN = 'Admin',
  SOCIAL = 'Social',
  OTHER = 'Other'
}

export enum ItemType {
  TASK = 'task',
  EVENT = 'event',
  IDEA = 'idea',
  INFO = 'important_info'
}

export interface Note {
  id: string;
  text: string;
  category: Category | string;
  item_type: ItemType | string;
  created_at_client: string;
  created_at_server: string;
  time_bucket?: string;
  source?: string;
  isEvent?: boolean;
  forwardedToCalendar?: boolean;
  status?: string; // e.g., 'FORWARDED', 'LOCAL'
}

export interface TrashedNote extends Note {
  deletedAt: string;
  trashId: string;
}

export type ViewType = 'inbox' | 'trash';

export interface GeminiNoteAnalysis {
  item_type: ItemType;
  category: Category;
  time_bucket: string;
  is_event: boolean;
  summary: string;
}
