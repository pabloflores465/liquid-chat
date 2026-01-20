import { useState, useEffect, useCallback, useRef } from 'react';
import { Message, Conversation, MessageStatus } from '../types/electron';

interface QueueItem {
  id: string;
  content: string;
  conversationId: string;
}

interface UseChatReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isGenerating: boolean;
  queueLength: number;
  llmStatus: string;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  createConversation: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, newTitle: string) => Promise<void>;
}

export function useChat(): UseChatReturn {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [llmStatus, setLlmStatus] = useState('Initializing...');
  const [queue, setQueue] = useState<QueueItem[]>([]);

  const streamingContentRef = useRef('');
  const isProcessingRef = useRef(false);
  const currentConversationRef = useRef<Conversation | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    currentConversationRef.current = currentConversation;
  }, [currentConversation]);

  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async (): Promise<void> => {
      const convs = await window.electron.conversations.getAll();
      setConversations(convs);

      const currentId = await window.electron.conversations.getCurrentId();
      if (currentId) {
        const current = convs.find((c) => c.id === currentId);
        if (current) {
          setCurrentConversation(current);
        }
      }
    };

    loadConversations();
  }, []);

  // Listen for LLM status updates
  useEffect(() => {
    const unsubscribe = window.electron.llm.onStatus((status) => {
      setLlmStatus(status);
    });

    return unsubscribe;
  }, []);

  // Listen for streaming chunks
  useEffect(() => {
    const unsubscribe = window.electron.llm.onChunk((chunk) => {
      streamingContentRef.current += chunk;

      setCurrentConversation((prev) => {
        if (!prev) return prev;

        const messages = [...prev.messages];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.status === 'generating') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content: streamingContentRef.current,
          };
        }

        return { ...prev, messages };
      });
    });

    return unsubscribe;
  }, []);

  const generateTitle = (content: string): string => {
    const words = content.split(' ').slice(0, 6).join(' ');
    return words.length > 40 ? words.substring(0, 40) + '...' : words;
  };

  const updateMessageStatus = useCallback((
    conversationId: string,
    messageId: string,
    status: MessageStatus,
    content?: string
  ) => {
    const updateConv = (conv: Conversation): Conversation => {
      if (conv.id !== conversationId) return conv;
      return {
        ...conv,
        messages: conv.messages.map((m) =>
          m.id === messageId
            ? { ...m, status, ...(content !== undefined ? { content } : {}) }
            : m
        ),
        updatedAt: Date.now(),
      };
    };

    setConversations((prev) => prev.map(updateConv));
    setCurrentConversation((prev) => (prev ? updateConv(prev) : prev));
  }, []);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queue.length === 0) return;

    isProcessingRef.current = true;
    const item = queue[0];

    // Find the conversation and assistant message to update
    const conversation = currentConversationRef.current;
    if (!conversation || conversation.id !== item.conversationId) {
      // Skip if conversation changed
      setQueue((prev) => prev.slice(1));
      isProcessingRef.current = false;
      return;
    }

    // Find the assistant message for this queue item
    const userMsgIndex = conversation.messages.findIndex(
      (m) => m.role === 'user' && m.content === item.content
    );
    const assistantMsg = conversation.messages[userMsgIndex + 1];

    if (!assistantMsg || assistantMsg.role !== 'assistant') {
      setQueue((prev) => prev.slice(1));
      isProcessingRef.current = false;
      return;
    }

    // Update status to generating
    updateMessageStatus(item.conversationId, assistantMsg.id, 'generating');
    setIsGenerating(true);
    streamingContentRef.current = '';

    try {
      const result = await window.electron.llm.generate(item.content);

      const finalStatus: MessageStatus = result.success || result.aborted ? 'complete' : 'error';
      updateMessageStatus(
        item.conversationId,
        assistantMsg.id,
        finalStatus,
        streamingContentRef.current
      );

      // Save conversation
      const updatedConv = currentConversationRef.current;
      if (updatedConv) {
        await window.electron.conversations.save(updatedConv);
      }
    } catch (error) {
      updateMessageStatus(item.conversationId, assistantMsg.id, 'error', 'Error generating response');
    } finally {
      setIsGenerating(false);
      setQueue((prev) => prev.slice(1));
      isProcessingRef.current = false;
    }
  }, [queue, updateMessageStatus]);

  // Process queue when it changes
  useEffect(() => {
    if (queue.length > 0 && !isProcessingRef.current) {
      processQueue();
    }
  }, [queue, processQueue]);

  const sendMessage = useCallback(async (content: string): Promise<void> => {
    if (!content.trim()) return;

    let conversation = currentConversationRef.current;

    // Create new conversation if none exists
    if (!conversation) {
      conversation = await window.electron.conversations.create();
      setConversations((prev) => [conversation!, ...prev]);
      setCurrentConversation(conversation);
      currentConversationRef.current = conversation;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      status: 'complete',
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'queued',
    };

    // Update title if first message
    const isFirstMessage = conversation.messages.length === 0;
    const newTitle = isFirstMessage ? generateTitle(content) : conversation.title;

    const updatedConversation: Conversation = {
      ...conversation,
      title: newTitle,
      messages: [...conversation.messages, userMessage, assistantMessage],
      updatedAt: Date.now(),
    };

    setCurrentConversation(updatedConversation);
    currentConversationRef.current = updatedConversation;
    setConversations((prev) =>
      prev.map((c) => (c.id === updatedConversation.id ? updatedConversation : c))
    );

    // Add to queue
    setQueue((prev) => [
      ...prev,
      {
        id: assistantMessage.id,
        content: content.trim(),
        conversationId: updatedConversation.id,
      },
    ]);
  }, []);

  const stopGeneration = useCallback((): void => {
    window.electron.llm.stop();
  }, []);

  const createConversation = useCallback(async (): Promise<void> => {
    const conversation = await window.electron.conversations.create();
    setConversations((prev) => [conversation, ...prev]);
    setCurrentConversation(conversation);
    currentConversationRef.current = conversation;
    await window.electron.llm.resetSession();
  }, []);

  const selectConversation = useCallback(async (id: string): Promise<void> => {
    const conversation = conversations.find((c) => c.id === id);
    if (conversation) {
      // If switching to a different conversation, stop generation and clear queue
      const previousConvId = currentConversationRef.current?.id;
      if (previousConvId && previousConvId !== id) {
        // Stop any ongoing generation
        if (isProcessingRef.current) {
          window.electron.llm.stop();
        }
        // Clear queue items for the previous conversation
        setQueue((prev) => prev.filter((item) => item.conversationId !== previousConvId));

        // Mark any queued/generating messages in the old conversation as complete
        setConversations((prevConvs) =>
          prevConvs.map((c) => {
            if (c.id !== previousConvId) return c;
            return {
              ...c,
              messages: c.messages.map((m) =>
                m.status === 'queued' || m.status === 'generating'
                  ? { ...m, status: 'complete' as const }
                  : m
              ),
            };
          })
        );
      }

      setCurrentConversation(conversation);
      currentConversationRef.current = conversation;
      await window.electron.conversations.setCurrentId(id);

      // Reset and load history
      await window.electron.llm.resetSession();
      if (conversation.messages.length > 0) {
        // Filter out incomplete messages when loading history
        const completeMessages = conversation.messages.filter(
          (m) => m.status === 'complete' || m.status === undefined
        );
        if (completeMessages.length > 0) {
          await window.electron.llm.loadHistory(completeMessages);
        }
      }
    }
  }, [conversations]);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await window.electron.conversations.delete(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));

    if (currentConversationRef.current?.id === id) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        await selectConversation(remaining[0].id);
      } else {
        setCurrentConversation(null);
        currentConversationRef.current = null;
        await window.electron.llm.resetSession();
      }
    }
  }, [conversations, selectConversation]);

  const renameConversation = useCallback(async (id: string, newTitle: string): Promise<void> => {
    const conversation = conversations.find((c) => c.id === id);
    if (!conversation || !newTitle.trim()) return;

    const updatedConversation: Conversation = {
      ...conversation,
      title: newTitle.trim(),
      updatedAt: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) => (c.id === id ? updatedConversation : c))
    );

    if (currentConversationRef.current?.id === id) {
      setCurrentConversation(updatedConversation);
      currentConversationRef.current = updatedConversation;
    }

    await window.electron.conversations.save(updatedConversation);
  }, [conversations]);

  return {
    conversations,
    currentConversation,
    isGenerating,
    queueLength: queue.length,
    llmStatus,
    sendMessage,
    stopGeneration,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  };
}
