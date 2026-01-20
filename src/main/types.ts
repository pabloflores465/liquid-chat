export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export interface ModelInfo {
  name: string;
  path: string;
  size: number;
  downloaded: boolean;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  modelPath: string | null;
}

export interface StoreSchema {
  conversations: Conversation[];
  settings: AppSettings;
  currentConversationId: string | null;
}
