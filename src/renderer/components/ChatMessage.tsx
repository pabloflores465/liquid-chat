import React from 'react';
import { Message } from '../types/electron';
import { MessageContent } from './MessageContent';

interface ChatMessageProps {
  message: Message;
  isDark: boolean;
  isStreaming?: boolean;
  queuePosition?: number;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Spinner(): React.ReactElement {
  return (
    <div className="spinner">
      <div className="spinner-circle"></div>
    </div>
  );
}

function QueueIndicator({ position }: { position: number }): React.ReactElement {
  return (
    <div className="queue-indicator">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12,6 12,12 16,14"/>
      </svg>
      <span>In queue{position > 1 ? ` (#${position})` : '...'}</span>
    </div>
  );
}

export function ChatMessage({ message, isDark, isStreaming, queuePosition }: ChatMessageProps): React.ReactElement {
  const isUser = message.role === 'user';
  const status = message.status || 'complete';

  const renderAssistantContent = (): React.ReactNode => {
    // Show queued state
    if (status === 'queued') {
      return <QueueIndicator position={queuePosition || 1} />;
    }

    // Show generating state with spinner or content
    if (status === 'generating') {
      if (message.content) {
        return (
          <>
            <MessageContent content={message.content} isDark={isDark} />
            <div className="generating-indicator">
              <Spinner />
            </div>
          </>
        );
      }
      return (
        <div className="generating-state">
          <Spinner />
          <span>Generating...</span>
        </div>
      );
    }

    // Show error state
    if (status === 'error') {
      return (
        <div className="error-state">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{message.content || 'Error generating response'}</span>
        </div>
      );
    }

    // Show complete content
    if (message.content) {
      return <MessageContent content={message.content} isDark={isDark} />;
    }

    // Fallback for streaming without status (backwards compatibility)
    if (isStreaming) {
      return (
        <div className="typing-indicator">
          <span></span>
          <span></span>
          <span></span>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={`message ${message.role} ${status !== 'complete' ? `status-${status}` : ''}`}>
      <div className="message-content">
        {isUser ? message.content : renderAssistantContent()}
      </div>
      <div className="message-time">{formatTime(message.timestamp)}</div>
    </div>
  );
}
