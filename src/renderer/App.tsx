import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';

type AppState = 'checking' | 'api-key' | 'ready';

function ApiKeySetup({ onComplete }: { onComplete: () => void }): React.ReactElement {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!apiKey.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await window.electron.llm.setApiKey(apiKey.trim());
      await window.electron.settings.update({ apiKey: apiKey.trim() });
      await window.electron.llm.initialize();
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="api-key-setup">
      <div className="api-key-content">
        <h1>Welcome to Liquid Chat</h1>
        <p>Enter your OpenRouter API key to get started.</p>
        <p className="api-key-hint">
          Get your API key at{' '}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
            openrouter.ai/keys
          </a>
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-..."
            className="api-key-input"
            disabled={isLoading}
            autoFocus
          />
          {error && <div className="api-key-error">{error}</div>}
          <button type="submit" className="api-key-submit" disabled={isLoading || !apiKey.trim()}>
            {isLoading ? 'Setting up...' : 'Start Chatting'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App(): React.ReactElement {
  const [appState, setAppState] = useState<AppState>('checking');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    conversations,
    currentConversation,
    isGenerating,
    generatingConversationId,
    queueLength,
    llmStatus,
    sendMessage,
    stopGeneration,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
  } = useChat();

  const { theme, isDark, cycleTheme } = useTheme();

  // Check API key on mount
  useEffect(() => {
    const checkApiKey = async (): Promise<void> => {
      const settings = await window.electron.settings.get();

      if (settings.apiKey) {
        await window.electron.llm.setApiKey(settings.apiKey);
        await window.electron.llm.initialize();
        setAppState('ready');
      } else {
        setAppState('api-key');
      }
    };

    checkApiKey();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

  const handleApiKeyComplete = useCallback((): void => {
    setAppState('ready');
  }, []);

  const getStatusDotClass = (): string => {
    if (appState !== 'ready') return 'loading';
    if (isGenerating) return 'loading';
    return '';
  };

  const getStatusText = (): string => {
    if (appState !== 'ready') return llmStatus;
    if (isGenerating && queueLength > 1) return `Generating... (${queueLength - 1} in queue)`;
    if (isGenerating) return 'Generating...';
    if (queueLength > 0) return `${queueLength} in queue`;
    return 'Ready';
  };

  if (appState === 'checking') {
    return (
      <div className="app">
        <div className="main-content">
          <div className="empty-state">
            <h2>Loading...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'api-key') {
    return (
      <div className="app">
        <div className="main-content">
          <ApiKeySetup onComplete={handleApiKeyComplete} />
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversation?.id ?? null}
        generatingConversationId={generatingConversationId}
        theme={theme}
        onNewChat={createConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onCycleTheme={cycleTheme}
      />

      <main className="main-content">
        <header className="chat-header">
          <h2>{currentConversation?.title ?? 'New Chat'}</h2>
          <div className="status-indicator">
            <span className={`status-dot ${getStatusDotClass()}`} />
            {getStatusText()}
          </div>
        </header>

        <div className="messages-container">
          {currentConversation?.messages.map((message, index) => {
            let queuePosition: number | undefined;
            if (message.status === 'queued') {
              const queuedMessages = currentConversation.messages.filter(
                (m) => m.status === 'queued'
              );
              queuePosition = queuedMessages.findIndex((m) => m.id === message.id) + 1;
            }

            return (
              <ChatMessage
                key={message.id}
                message={message}
                isDark={isDark}
                queuePosition={queuePosition}
                isStreaming={
                  isGenerating &&
                  index === currentConversation.messages.length - 1 &&
                  message.role === 'assistant'
                }
              />
            );
          })}

          {!currentConversation?.messages.length && (
            <div className="empty-state">
              <h2>Start a conversation</h2>
              <p>
                Send a message to begin chatting with Qwen3.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={sendMessage}
          onStop={stopGeneration}
          isGenerating={isGenerating}
          disabled={appState !== 'ready'}
        />
      </main>
    </div>
  );
}
