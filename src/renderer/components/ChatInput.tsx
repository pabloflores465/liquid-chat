import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export function ChatInput({ onSend, onStop, isGenerating, disabled }: ChatInputProps): React.ReactElement {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback((): void => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [message, adjustHeight]);

  const handleSubmit = useCallback((): void => {
    if (message.trim() && !isGenerating && !disabled) {
      onSend(message);
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [message, isGenerating, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setMessage(e.target.value);
  }, []);

  return (
    <div className="input-container">
      <div className="input-wrapper">
        <div className="input-field">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Loading model...' : 'Type a message...'}
            disabled={disabled}
            rows={1}
          />
        </div>
        {isGenerating ? (
          <button className="send-btn stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button
            className="send-btn"
            onClick={handleSubmit}
            disabled={!message.trim() || disabled}
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
