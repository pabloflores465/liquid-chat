import { contextBridge, ipcRenderer, IpcRendererEvent, shell } from 'electron';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

type ModelId = 'qwen3-4b' | 'qwen3-4b-thinking';

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  modelPath: string | null;
  selectedModel: ModelId;
}

interface ModelInfo {
  id: ModelId;
  name: string;
  path: string;
  size: number;
  downloaded: boolean;
  supportsThinking: boolean;
  description: string;
}

interface DownloadProgress {
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

interface ChunkData {
  chunk: string;
  conversationId: string | null;
  type: 'thinking' | 'content';
}

type Callback<T> = (data: T) => void;

const electronAPI = {
  model: {
    getAll: (): Promise<ModelInfo[]> => ipcRenderer.invoke('model:get-all'),
    getInfo: (modelId: ModelId): Promise<ModelInfo> => ipcRenderer.invoke('model:get-info', modelId),
    download: (modelId: ModelId): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('model:download', modelId),
    cancelDownload: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('model:cancel-download'),
    onDownloadProgress: (callback: Callback<DownloadProgress>): (() => void) => {
      const handler = (_event: IpcRendererEvent, progress: DownloadProgress): void => {
        callback(progress);
      };
      ipcRenderer.on('model:download-progress', handler);
      return () => ipcRenderer.removeListener('model:download-progress', handler);
    },
  },

  llm: {
    initialize: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('llm:initialize'),
    isReady: (): Promise<boolean> => ipcRenderer.invoke('llm:is-ready'),
    resetSession: (): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('llm:reset-session'),
    loadHistory: (messages: Message[]): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('llm:load-history', messages),
    generate: (prompt: string): Promise<{ success: boolean; response?: string; error?: string; aborted?: boolean }> =>
      ipcRenderer.invoke('llm:generate', prompt),
    stop: (): Promise<{ success: boolean }> => ipcRenderer.invoke('llm:stop'),
    setGeneratingConversation: (id: string | null): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('llm:set-generating-conversation', id),
    getGeneratingConversation: (): Promise<string | null> =>
      ipcRenderer.invoke('llm:get-generating-conversation'),
    isGenerating: (): Promise<boolean> =>
      ipcRenderer.invoke('llm:is-generating'),
    onChunk: (callback: Callback<ChunkData>): (() => void) => {
      const handler = (_event: IpcRendererEvent, data: ChunkData): void => {
        callback(data);
      };
      ipcRenderer.on('llm:chunk', handler);
      return () => ipcRenderer.removeListener('llm:chunk', handler);
    },
    onStatus: (callback: Callback<string>): (() => void) => {
      const handler = (_event: IpcRendererEvent, status: string): void => {
        callback(status);
      };
      ipcRenderer.on('llm:status', handler);
      return () => ipcRenderer.removeListener('llm:status', handler);
    },
  },

  conversations: {
    getAll: (): Promise<Conversation[]> => ipcRenderer.invoke('conversations:get-all'),
    getPaginated: (limit: number, offset: number): Promise<{ conversations: Conversation[]; total: number }> =>
      ipcRenderer.invoke('conversations:get-paginated', limit, offset),
    get: (id: string): Promise<Conversation | undefined> =>
      ipcRenderer.invoke('conversations:get', id),
    create: (): Promise<Conversation> => ipcRenderer.invoke('conversations:create'),
    save: (conversation: Conversation): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('conversations:save', conversation),
    delete: (id: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('conversations:delete', id),
    getCurrentId: (): Promise<string | null> =>
      ipcRenderer.invoke('conversations:get-current-id'),
    setCurrentId: (id: string | null): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('conversations:set-current-id', id),
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (settings: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', settings),
  },

  theme: {
    getSystem: (): Promise<boolean> => ipcRenderer.invoke('theme:get-system'),
    onChanged: (callback: Callback<boolean>): (() => void) => {
      const handler = (_event: IpcRendererEvent, isDark: boolean): void => {
        callback(isDark);
      };
      ipcRenderer.on('theme:changed', handler);
      return () => ipcRenderer.removeListener('theme:changed', handler);
    },
  },

  shell: {
    openExternal: (url: string): Promise<void> => shell.openExternal(url),
  },
};

contextBridge.exposeInMainWorld('electron', electronAPI);
