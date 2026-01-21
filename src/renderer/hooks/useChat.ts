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
  const [backgroundGeneratingConvId, setBackgroundGeneratingConvId] = useState<string | null>(null);
  const [pendingSessionReset, setPendingSessionReset] = useState<string | null>(null);
  const streamingContentByConvRef = useRef<Map<string, string>>(new Map());

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
    const unsubscribe = window.electron.llm.onChunk((data) => {
      const { chunk, conversationId } = data;

      // Determine which conversation this chunk belongs to
      const targetConvId = conversationId || currentConversationRef.current?.id;
      if (!targetConvId) return;

      // Update streaming content for this conversation
      const currentContent = streamingContentByConvRef.current.get(targetConvId) || '';
      const newContent = currentContent + chunk;
      streamingContentByConvRef.current.set(targetConvId, newContent);

      // Also update the legacy ref for compatibility
      if (targetConvId === currentConversationRef.current?.id) {
        streamingContentRef.current = newContent;
      }

      // Update the appropriate conversation
      const updateConversationMessages = (conv: Conversation): Conversation => {
        if (conv.id !== targetConvId) return conv;

        const messages = [...conv.messages];
        const lastMessage = messages[messages.length - 1];

        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.status === 'generating') {
          messages[messages.length - 1] = {
            ...lastMessage,
            content: newContent,
          };
        }

        return { ...conv, messages };
      };

      // Update both state arrays
      setConversations((prev) => prev.map(updateConversationMessages));

      // Only update currentConversation if it's the target
      if (targetConvId === currentConversationRef.current?.id) {
        setCurrentConversation((prev) => (prev ? updateConversationMessages(prev) : prev));
      }
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

    // Find the conversation from state (not just current ref - supports background generation)
    const conversationsSnapshot = await new Promise<Conversation[]>((resolve) => {
      setConversations((prev) => {
        resolve(prev);
        return prev;
      });
    });

    const conversation = conversationsSnapshot.find((c) => c.id === item.conversationId);
    if (!conversation) {
      // Skip if conversation doesn't exist
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

    // Tell the main process which conversation we're generating for
    await window.electron.llm.setGeneratingConversation(item.conversationId);

    // Update status to generating
    updateMessageStatus(item.conversationId, assistantMsg.id, 'generating');
    setIsGenerating(true);

    // Initialize streaming content for this conversation
    streamingContentByConvRef.current.set(item.conversationId, '');
    streamingContentRef.current = '';

    try {
      const result = await window.electron.llm.generate(item.content);

      // Get the final streaming content for this conversation
      const finalContent = streamingContentByConvRef.current.get(item.conversationId) || '';

      const finalStatus: MessageStatus = result.success || result.aborted ? 'complete' : 'error';
      updateMessageStatus(
        item.conversationId,
        assistantMsg.id,
        finalStatus,
        finalContent
      );

      // Get the updated conversation from state and save it
      const updatedConversations = await new Promise<Conversation[]>((resolve) => {
        setConversations((prev) => {
          resolve(prev);
          return prev;
        });
      });
      const updatedConv = updatedConversations.find((c) => c.id === item.conversationId);
      if (updatedConv) {
        await window.electron.conversations.save(updatedConv);
      }

      // Clean up streaming content for this conversation
      streamingContentByConvRef.current.delete(item.conversationId);
    } catch (error) {
      updateMessageStatus(item.conversationId, assistantMsg.id, 'error', 'Error generating response');
      streamingContentByConvRef.current.delete(item.conversationId);
    } finally {
      setIsGenerating(false);
      setBackgroundGeneratingConvId(null);
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

  // Handle pending session reset after background generation completes
  useEffect(() => {
    if (!isGenerating && pendingSessionReset && !backgroundGeneratingConvId) {
      const performPendingReset = async (): Promise<void> => {
        await window.electron.llm.resetSession();

        // Find the conversation to load history for
        const conv = conversations.find((c) => c.id === pendingSessionReset);
        if (conv && conv.messages.length > 0) {
          const completeMessages = conv.messages.filter(
            (m) => m.status === 'complete' || m.status === undefined
          );
          if (completeMessages.length > 0) {
            await window.electron.llm.loadHistory(completeMessages);
          }
        }

        setPendingSessionReset(null);
      };

      performPendingReset();
    }
  }, [isGenerating, pendingSessionReset, backgroundGeneratingConvId, conversations]);

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
      const previousConvId = currentConversationRef.current?.id;

      // If switching to a different conversation while generating, let it continue in background
      if (previousConvId && previousConvId !== id && isProcessingRef.current) {
        // Set the background generating conversation
        setBackgroundGeneratingConvId(previousConvId);
        // Queue the session reset for when generation completes
        setPendingSessionReset(id);

        // Update UI to show the new conversation
        setCurrentConversation(conversation);
        currentConversationRef.current = conversation;
        await window.electron.conversations.setCurrentId(id);

        // Don't reset session or load history yet - wait for background generation to complete
        return;
      }

      setCurrentConversation(conversation);
      currentConversationRef.current = conversation;
      await window.electron.conversations.setCurrentId(id);

      // Reset and load history (only if not waiting for background generation)
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
