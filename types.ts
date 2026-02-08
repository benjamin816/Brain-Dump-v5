
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
  metadata?: {
    detectedTime?: string;
    summary?: string;
  };
}

export interface GeminiNoteAnalysis {
  category: Category;
  isEvent: boolean;
  summary: string;
  detectedTime?: string;
}
