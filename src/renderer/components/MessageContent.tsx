import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from './CodeBlock';
import type { Components } from 'react-markdown';

interface MessageContentProps {
  content: string;
  isDark: boolean;
}

export function MessageContent({ content, isDark }: MessageContentProps): React.ReactElement {
  const components: Components = {
    code(props) {
      const { children, className, ...rest } = props;
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');

      // Check if this is a code block (has language or is multiline)
      const isCodeBlock = match || codeString.includes('\n');

      if (isCodeBlock) {
        return (
          <CodeBlock
            language={match ? match[1] : ''}
            code={codeString}
            isDark={isDark}
          />
        );
      }

      // Inline code
      return (
        <code className={className} {...rest}>
          {children}
        </code>
      );
    },
    // Override pre to avoid double wrapping
    pre(props) {
      const { children } = props;
      return <>{children}</>;
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
