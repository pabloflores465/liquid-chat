import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatMessage } from './ChatMessage';
import { Message } from '../types/electron';

describe('ChatMessage', () => {
  const baseMessage: Message = {
    id: 'test-1',
    role: 'user',
    content: 'Hello, world!',
    timestamp: Date.now(),
    status: 'complete',
  };

  it('renders user message correctly', () => {
    render(<ChatMessage message={baseMessage} isDark={false} />);

    expect(screen.getByText('Hello, world!')).toBeInTheDocument();
  });

  it('renders assistant message with markdown', () => {
    const assistantMessage: Message = {
      ...baseMessage,
      id: 'test-2',
      role: 'assistant',
      content: '**Bold text** and *italic text*',
      status: 'complete',
    };

    render(<ChatMessage message={assistantMessage} isDark={false} />);

    expect(screen.getByText('Bold text')).toBeInTheDocument();
    expect(screen.getByText('and')).toBeInTheDocument();
    expect(screen.getByText('italic text')).toBeInTheDocument();
  });

  it('applies correct CSS class for user messages', () => {
    const { container } = render(<ChatMessage message={baseMessage} isDark={false} />);

    const messageDiv = container.querySelector('.message.user');
    expect(messageDiv).toBeInTheDocument();
  });

  it('applies correct CSS class for assistant messages', () => {
    const assistantMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      status: 'complete',
    };

    const { container } = render(<ChatMessage message={assistantMessage} isDark={false} />);

    const messageDiv = container.querySelector('.message.assistant');
    expect(messageDiv).toBeInTheDocument();
  });

  it('shows generating state with spinner', () => {
    const generatingMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: '',
      status: 'generating',
    };

    const { container } = render(
      <ChatMessage message={generatingMessage} isDark={false} />
    );

    const spinner = container.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();
    expect(screen.getByText('Generating...')).toBeInTheDocument();
  });

  it('shows queue indicator for queued messages', () => {
    const queuedMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: '',
      status: 'queued',
    };

    render(<ChatMessage message={queuedMessage} isDark={false} queuePosition={2} />);

    expect(screen.getByText('In queue (#2)')).toBeInTheDocument();
  });

  it('shows spinner with content when generating with partial response', () => {
    const generatingWithContent: Message = {
      ...baseMessage,
      role: 'assistant',
      content: 'Partial response...',
      status: 'generating',
    };

    const { container } = render(
      <ChatMessage message={generatingWithContent} isDark={false} />
    );

    expect(screen.getByText(/Partial response/)).toBeInTheDocument();
    expect(container.querySelector('.generating-indicator .spinner')).toBeInTheDocument();
  });

  it('formats timestamp correctly', () => {
    const fixedTime = new Date('2024-01-15T14:30:00').getTime();
    const messageWithTime: Message = {
      ...baseMessage,
      timestamp: fixedTime,
    };

    render(<ChatMessage message={messageWithTime} isDark={false} />);

    // The time should be formatted based on locale
    const timeElement = document.querySelector('.message-time');
    expect(timeElement).toBeInTheDocument();
  });

  it('renders code blocks in assistant messages', () => {
    const codeMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: '```javascript\nconst x = 1;\n```',
      status: 'complete',
    };

    const { container } = render(<ChatMessage message={codeMessage} isDark={false} />);

    const codeBlock = container.querySelector('.code-block');
    expect(codeBlock).toBeInTheDocument();
  });

  it('shows error state for failed messages', () => {
    const errorMessage: Message = {
      ...baseMessage,
      role: 'assistant',
      content: 'Something went wrong',
      status: 'error',
    };

    const { container } = render(<ChatMessage message={errorMessage} isDark={false} />);

    const errorState = container.querySelector('.error-state');
    expect(errorState).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });
});
