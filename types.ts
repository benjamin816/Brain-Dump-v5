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
  category: string;
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

export type ViewType = 'inbox' | 'trash' | 'settings';

export interface GeminiNoteAnalysis {
  item_type: ItemType;
  category: string;
  time_bucket: string;
  is_event: boolean;
  summary: string;
}

export interface ForwardResponse {
  success: boolean;
  status?: number;
  error?: string;
  data?: {
    id?: string;
    action?: string;
    calendarId?: string;
    start?: string;
    end?: string;
    date?: string;
    [key: string]: any;
  };
}