import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useChat } from './useChat';
import { mockElectronAPI } from '../../test/setup';
import { Conversation } from '../types/electron';

describe('useChat', () => {
  const mockConversation: Conversation = {
    id: 'conv-1',
    title: 'Test Chat',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.conversations.getAll.mockResolvedValue([]);
    mockElectronAPI.conversations.getCurrentId.mockResolvedValue(null);
    mockElectronAPI.llm.onStatus.mockReturnValue(() => {});
    mockElectronAPI.llm.onChunk.mockReturnValue(() => {});
  });

  it('loads conversations on mount', async () => {
    mockElectronAPI.conversations.getAll.mockResolvedValue([mockConversation]);

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });
  });

  it('sets current conversation if one exists', async () => {
    mockElectronAPI.conversations.getAll.mockResolvedValue([mockConversation]);
    mockElectronAPI.conversations.getCurrentId.mockResolvedValue('conv-1');

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.currentConversation?.id).toBe('conv-1');
    });
  });

  it('creates new conversation', async () => {
    const newConversation: Conversation = {
      id: 'new-conv',
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockElectronAPI.conversations.create.mockResolvedValue(newConversation);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.createConversation();
    });

    expect(mockElectronAPI.conversations.create).toHaveBeenCalled();
    expect(mockElectronAPI.llm.resetSession).toHaveBeenCalled();
    expect(result.current.currentConversation?.id).toBe('new-conv');
  });

  it('selects conversation and loads history', async () => {
    const conversationWithMessages: Conversation = {
      ...mockConversation,
      messages: [
        { id: '1', role: 'user', content: 'Hello', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'Hi!', timestamp: Date.now() },
      ],
    };
    mockElectronAPI.conversations.getAll.mockResolvedValue([conversationWithMessages]);

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
    });

    await act(async () => {
      await result.current.selectConversation('conv-1');
    });

    expect(mockElectronAPI.conversations.setCurrentId).toHaveBeenCalledWith('conv-1');
    expect(mockElectronAPI.llm.resetSession).toHaveBeenCalled();
    expect(mockElectronAPI.llm.loadHistory).toHaveBeenCalled();
  });

  it('deletes conversation', async () => {
    mockElectronAPI.conversations.getAll.mockResolvedValue([mockConversation]);
    mockElectronAPI.conversations.getCurrentId.mockResolvedValue('conv-1');

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.currentConversation?.id).toBe('conv-1');
    });

    await act(async () => {
      await result.current.deleteConversation('conv-1');
    });

    expect(mockElectronAPI.conversations.delete).toHaveBeenCalledWith('conv-1');
    expect(result.current.conversations).toHaveLength(0);
  });

  it('sends message and creates conversation if none exists', async () => {
    const newConversation: Conversation = {
      id: 'new-conv',
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockElectronAPI.conversations.create.mockResolvedValue(newConversation);
    mockElectronAPI.llm.generate.mockResolvedValue({ success: true, response: 'Hello!' });

    const { result } = renderHook(() => useChat());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.conversations).toBeDefined();
    });

    await act(async () => {
      await result.current.sendMessage('Hi');
    });

    expect(mockElectronAPI.conversations.create).toHaveBeenCalled();

    // Wait for queue to be processed
    await waitFor(() => {
      expect(mockElectronAPI.llm.generate).toHaveBeenCalledWith('Hi');
    });
  });

  it('stops generation when stopGeneration is called', async () => {
    const { result } = renderHook(() => useChat());

    // Wait for hook to be ready
    await waitFor(() => {
      expect(result.current.stopGeneration).toBeDefined();
    });

    act(() => {
      result.current.stopGeneration();
    });

    expect(mockElectronAPI.llm.stop).toHaveBeenCalled();
  });

  it('subscribes to LLM events on mount', async () => {
    renderHook(() => useChat());

    // The subscription happens in useEffect, need to wait
    await waitFor(() => {
      expect(mockElectronAPI.llm.onStatus).toHaveBeenCalled();
      expect(mockElectronAPI.llm.onChunk).toHaveBeenCalled();
    });
  });

  it('does not send empty messages', async () => {
    const { result } = renderHook(() => useChat());

    // Wait for hook to be ready
    await waitFor(() => {
      expect(result.current.sendMessage).toBeDefined();
    });

    await act(async () => {
      await result.current.sendMessage('   ');
    });

    expect(mockElectronAPI.llm.generate).not.toHaveBeenCalled();
  });

  it('generates title from first message', async () => {
    const newConversation: Conversation = {
      id: 'new-conv',
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    mockElectronAPI.conversations.create.mockResolvedValue(newConversation);
    mockElectronAPI.llm.generate.mockResolvedValue({ success: true, response: 'Response' });

    const { result } = renderHook(() => useChat());

    // Wait for hook to be ready
    await waitFor(() => {
      expect(result.current.sendMessage).toBeDefined();
    });

    await act(async () => {
      await result.current.sendMessage('This is my first message to the chatbot');
    });

    // Title is set immediately when sending the message
    expect(result.current.currentConversation?.title).toContain('This is my first');
  });

  it('returns queueLength', async () => {
    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.queueLength).toBe(0);
    });
  });
});
