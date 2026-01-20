import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  const defaultProps = {
    onSend: vi.fn(),
    onStop: vi.fn(),
    isGenerating: false,
    disabled: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders textarea and send button', () => {
    render(<ChatInput {...defaultProps} />);

    expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('shows loading placeholder when disabled', () => {
    render(<ChatInput {...defaultProps} disabled={true} />);

    expect(screen.getByPlaceholderText('Loading model...')).toBeInTheDocument();
  });

  it('calls onSend when clicking send button with text', async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    await userEvent.type(textarea, 'Hello');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('clears input after sending', async () => {
    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type a message...') as HTMLTextAreaElement;
    await userEvent.type(textarea, 'Hello');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    expect(textarea.value).toBe('');
  });

  it('sends message on Enter key press', async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    await userEvent.type(textarea, 'Hello{enter}');

    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('does not send on Shift+Enter (allows multiline)', async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables send button when textarea is empty', () => {
    render(<ChatInput {...defaultProps} />);

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).toBeDisabled();
  });

  it('enables send button when textarea has text', async () => {
    render(<ChatInput {...defaultProps} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    await userEvent.type(textarea, 'Hello');

    const sendButton = screen.getByRole('button', { name: /send/i });
    expect(sendButton).not.toBeDisabled();
  });

  it('shows Stop button when generating', () => {
    render(<ChatInput {...defaultProps} isGenerating={true} />);

    expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
  });

  it('calls onStop when clicking Stop button', async () => {
    const onStop = vi.fn();
    render(<ChatInput {...defaultProps} isGenerating={true} onStop={onStop} />);

    const stopButton = screen.getByRole('button', { name: /stop/i });
    await userEvent.click(stopButton);

    expect(onStop).toHaveBeenCalled();
  });

  it('does not call onSend with whitespace-only input', async () => {
    const onSend = vi.fn();
    render(<ChatInput {...defaultProps} onSend={onSend} />);

    const textarea = screen.getByPlaceholderText('Type a message...');
    await userEvent.type(textarea, '   ');

    const sendButton = screen.getByRole('button', { name: /send/i });
    await userEvent.click(sendButton);

    expect(onSend).not.toHaveBeenCalled();
  });
});
