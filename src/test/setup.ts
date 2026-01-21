import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock window.electron API
const mockElectronAPI = {
  llm: {
    initialize: vi.fn().mockResolvedValue({ success: true }),
    isReady: vi.fn().mockResolvedValue(true),
    setApiKey: vi.fn().mockResolvedValue({ success: true }),
    getApiKey: vi.fn().mockResolvedValue('test-api-key'),
    resetSession: vi.fn().mockResolvedValue({ success: true }),
    loadHistory: vi.fn().mockResolvedValue({ success: true }),
    generate: vi.fn().mockResolvedValue({ success: true, response: 'Test response' }),
    stop: vi.fn().mockResolvedValue({ success: true }),
    setGeneratingConversation: vi.fn().mockResolvedValue({ success: true }),
    getGeneratingConversation: vi.fn().mockResolvedValue(null),
    isGenerating: vi.fn().mockResolvedValue(false),
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
    get: vi.fn().mockResolvedValue({ theme: 'system', apiKey: 'test-api-key' }),
    update: vi.fn().mockResolvedValue({ theme: 'dark', apiKey: 'test-api-key' }),
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
