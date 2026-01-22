import React, { useState } from 'react';
import { MessageContent } from './MessageContent';

interface ThinkingSectionProps {
  thinking: string;
  isDark: boolean;
  isStreaming?: boolean;
}

export function ThinkingSection({ thinking, isDark, isStreaming }: ThinkingSectionProps): React.ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  const toggleExpanded = (): void => {
    setIsExpanded((prev) => !prev);
  };

  return (
    <div className={`thinking-section ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="thinking-toggle"
        onClick={toggleExpanded}
        type="button"
        aria-expanded={isExpanded}
      >
        <svg
          className={`thinking-chevron ${isExpanded ? 'rotated' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="9,18 15,12 9,6" />
        </svg>
        <span className="thinking-label">
          Thinking{isStreaming ? '...' : ''}
        </span>
      </button>
      {isExpanded && (
        <div className="thinking-content">
          <MessageContent content={thinking} isDark={isDark} />
        </div>
      )}
    </div>
  );
}
