import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electron API
const mockElectronAPI = {
  model: {
    getInfo: vi.fn().mockResolvedValue({
      name: 'Test Model',
      path: '/test/model.gguf',
      size: 1000000,
      downloaded: true,
    }),
    download: vi.fn().mockResolvedValue({ success: true, path: '/test/model.gguf' }),
    cancelDownload: vi.fn().mockResolvedValue({ success: true }),
    onDownloadProgress: vi.fn().mockReturnValue(() => {}),
  },
  llm: {
    initialize: vi.fn().mockResolvedValue({ success: true }),
    isReady: vi.fn().mockResolvedValue(true),
    resetSession: vi.fn().mockResolvedValue({ success: true }),
    loadHistory: vi.fn().mockResolvedValue({ success: true }),
    generate: vi.fn().mockResolvedValue({ success: true, response: 'Test response' }),
    stop: vi.fn().mockResolvedValue({ success: true }),
    onChunk: vi.fn().mockReturnValue(() => {}),
    onStatus: vi.fn().mockReturnValue(() => {}),
  },
  conversations: {
    getAll: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({
      id: 'test-id',
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
    save: vi.fn().mockResolvedValue({ success: true }),
    delete: vi.fn().mockResolvedValue({ success: true }),
    getCurrentId: vi.fn().mockResolvedValue(null),
    setCurrentId: vi.fn().mockResolvedValue({ success: true }),
  },
  settings: {
    get: vi.fn().mockResolvedValue({ theme: 'system', modelPath: null }),
    update: vi.fn().mockResolvedValue({ theme: 'dark', modelPath: null }),
  },
  theme: {
    getSystem: vi.fn().mockResolvedValue(false),
    onChanged: vi.fn().mockReturnValue(() => {}),
  },
};

// @ts-expect-error - Adding mock to window
window.electron = mockElectronAPI;

// Mock crypto.randomUUID
if (!crypto.randomUUID) {
  crypto.randomUUID = () => 'test-uuid-' + Math.random().toString(36).substr(2, 9);
}

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

export { mockElectronAPI };
