import React, { useState, useCallback } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  language: string;
  code: string;
  isDark: boolean;
}

export function CodeBlock({ language, code, isDark }: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API failed, ignore
    }
  }, [code]);

  const displayLanguage = language || 'text';

  return (
    <div className="code-block">
      <div className="code-header">
        <span className="code-language">{displayLanguage}</span>
        <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={isDark ? oneDark : oneLight}
        customStyle={{
          margin: 0,
          padding: '12px',
          background: 'transparent',
          fontSize: '13px',
        }}
        showLineNumbers={code.split('\n').length > 3}
        wrapLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
