import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ModelDownload } from './components/ModelDownload';
import { useChat } from './hooks/useChat';
import { useTheme } from './hooks/useTheme';

type AppState = 'checking' | 'download' | 'loading' | 'ready';

export default function App(): React.ReactElement {
  const [appState, setAppState] = useState<AppState>('checking');
  const messagesContainerRef = useRef<HTMLDivElement>(null);

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

  // Check model status on mount
  useEffect(() => {
    const checkModel = async (): Promise<void> => {
      const settings = await window.electron.settings.get();
      const info = await window.electron.model.getInfo(settings.selectedModel);

      if (info.downloaded) {
        setAppState('loading');
        const result = await window.electron.llm.initialize();
        if (result.success) {
          setAppState('ready');
        }
      } else {
        setAppState('download');
      }
    };

    checkModel();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [currentConversation?.messages]);

  const handleDownloadComplete = useCallback(async (): Promise<void> => {
    setAppState('loading');
    const result = await window.electron.llm.initialize();
    if (result.success) {
      setAppState('ready');
    }
  }, []);

  const getStatusDotClass = (): string => {
    if (appState !== 'ready') return 'loading';
    if (isGenerating) return 'loading';
    return '';
  };

  const getStatusText = (): string => {
    if (appState === 'loading') return llmStatus;
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

  if (appState === 'download') {
    return (
      <div className="app">
        <div className="main-content">
          <ModelDownload onDownloadComplete={handleDownloadComplete} />
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
        onNewChat={createConversation}
        onSelectConversation={selectConversation}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
      />

      <main className="main-content">
        <header className="chat-header">
          <h2>{currentConversation?.title ?? 'New Chat'}</h2>
          <div className="header-right">
            <div className="status-indicator">
              <span className={`status-dot ${getStatusDotClass()}`} />
              {getStatusText()}
            </div>
            <div className="theme-toggle">
              <button
                className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                onClick={() => theme !== 'light' && cycleTheme()}
                title="Light"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2"/>
                  <path d="M12 20v2"/>
                  <path d="m4.93 4.93 1.41 1.41"/>
                  <path d="m17.66 17.66 1.41 1.41"/>
                  <path d="M2 12h2"/>
                  <path d="M20 12h2"/>
                  <path d="m6.34 17.66-1.41 1.41"/>
                  <path d="m19.07 4.93-1.41 1.41"/>
                </svg>
              </button>
              <button
                className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => theme !== 'dark' && cycleTheme()}
                title="Dark"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              </button>
              <button
                className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
                onClick={() => theme !== 'system' && cycleTheme()}
                title="System"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 3v18"/>
                  <path d="M12 3a9 9 0 0 1 0 18"/>
                </svg>
              </button>
            </div>
          </div>
        </header>

        <div className="messages-container" ref={messagesContainerRef}>
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
                The model runs entirely on your Mac.
              </p>
            </div>
          )}
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
