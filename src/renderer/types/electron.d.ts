export type MessageStatus = 'queued' | 'generating' | 'complete' | 'error';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thinking?: string;
  timestamp: number;
  status?: MessageStatus;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export type ModelId = 'qwen3-4b' | 'qwen3-4b-thinking';

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

export interface ChunkData {
  chunk: string;
  conversationId: string | null;
  type: 'thinking' | 'content';
}

type Callback<T> = (data: T) => void;

export interface ElectronAPI {
  model: {
    getAll: () => Promise<ModelInfo[]>;
    getInfo: (modelId: ModelId) => Promise<ModelInfo>;
    download: (modelId: ModelId) => Promise<{ success: boolean; path?: string; error?: string }>;
    cancelDownload: () => Promise<{ success: boolean }>;
    onDownloadProgress: (callback: Callback<DownloadProgress>) => () => void;
  };
  llm: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    isReady: () => Promise<boolean>;
    resetSession: () => Promise<{ success: boolean }>;
    loadHistory: (messages: Message[]) => Promise<{ success: boolean; error?: string }>;
    generate: (prompt: string) => Promise<{ success: boolean; response?: string; error?: string; aborted?: boolean }>;
    stop: () => Promise<{ success: boolean }>;
    setGeneratingConversation: (id: string | null) => Promise<{ success: boolean }>;
    getGeneratingConversation: () => Promise<string | null>;
    isGenerating: () => Promise<boolean>;
    onChunk: (callback: Callback<ChunkData>) => () => void;
    onStatus: (callback: Callback<string>) => () => void;
  };
  conversations: {
    getAll: () => Promise<Conversation[]>;
    getPaginated: (limit: number, offset: number) => Promise<{ conversations: Conversation[]; total: number }>;
    get: (id: string) => Promise<Conversation | undefined>;
    create: () => Promise<Conversation>;
    save: (conversation: Conversation) => Promise<{ success: boolean }>;
    delete: (id: string) => Promise<{ success: boolean }>;
    getCurrentId: () => Promise<string | null>;
    setCurrentId: (id: string | null) => Promise<{ success: boolean }>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (settings: Partial<AppSettings>) => Promise<AppSettings>;
  };
  theme: {
    getSystem: () => Promise<boolean>;
    onChanged: (callback: Callback<boolean>) => () => void;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
