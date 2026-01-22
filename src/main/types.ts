export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type ModelId = 'qwen3-4b' | 'qwen3-4b-thinking';

export interface ModelDefinition {
  id: ModelId;
  name: string;
  filename: string;
  url: string;
  supportsThinking: boolean;
  description: string;
}

export interface ModelInfo {
  id: ModelId;
  name: string;
  path: string;
  size: number;
  downloaded: boolean;
  supportsThinking: boolean;
  description: string;
}

export interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  modelPath: string | null;
  selectedModel: ModelId;
}

export interface StoreSchema {
  conversations: Conversation[];
  settings: AppSettings;
  currentConversationId: string | null;
}
