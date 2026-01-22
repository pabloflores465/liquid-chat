import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
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
    // Open links in external browser
    a(props) {
      const { href, children, ...rest } = props;
      const handleClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
        e.preventDefault();
        if (href) {
          window.electron.shell.openExternal(href);
        }
      };
      return (
        <a href={href} onClick={handleClick} {...rest}>
          {children}
        </a>
      );
    },
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={components}
    >
      {content}
    </ReactMarkdown>
  );
}
