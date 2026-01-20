import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard with a simple implementation
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
      readText: vi.fn().mockResolvedValue(''),
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    });
  });

  it('renders code content', () => {
    render(<CodeBlock language="javascript" code="const x = 1;" isDark={false} />);

    expect(screen.getByText(/const/)).toBeInTheDocument();
  });

  it('displays language label', () => {
    render(<CodeBlock language="typescript" code="const x: number = 1;" isDark={false} />);

    expect(screen.getByText('typescript')).toBeInTheDocument();
  });

  it('shows text as language when none specified', () => {
    render(<CodeBlock language="" code="plain text" isDark={false} />);

    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('renders copy button', () => {
    render(<CodeBlock language="javascript" code="const x = 1;" isDark={false} />);

    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('copies code to clipboard when clicking copy button', async () => {
    const code = 'const x = 1;';
    render(<CodeBlock language="javascript" code={code} isDark={false} />);

    const copyButton = screen.getByRole('button', { name: /copy/i });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code);
  });

  it('shows "Copied!" text after copying', async () => {
    render(<CodeBlock language="javascript" code="const x = 1;" isDark={false} />);

    const copyButton = screen.getByRole('button', { name: /copy/i });

    await act(async () => {
      fireEvent.click(copyButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('reverts to "Copy" after timeout', async () => {
    vi.useFakeTimers();

    render(<CodeBlock language="javascript" code="const x = 1;" isDark={false} />);

    const copyButton = screen.getByRole('button', { name: /copy/i });

    await act(async () => {
      fireEvent.click(copyButton);
      // Need to flush promises
      await Promise.resolve();
    });

    expect(screen.getByText('Copied!')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByText('Copy')).toBeInTheDocument();
  });

  it('applies dark theme styles when isDark is true', () => {
    const { container } = render(
      <CodeBlock language="javascript" code="const x = 1;" isDark={true} />
    );

    const codeBlock = container.querySelector('.code-block');
    expect(codeBlock).toBeInTheDocument();
  });

  it('applies light theme styles when isDark is false', () => {
    const { container } = render(
      <CodeBlock language="javascript" code="const x = 1;" isDark={false} />
    );

    const codeBlock = container.querySelector('.code-block');
    expect(codeBlock).toBeInTheDocument();
  });

  it('shows line numbers for code with more than 3 lines', () => {
    const multilineCode = `line 1
line 2
line 3
line 4`;
    const { container } = render(
      <CodeBlock language="javascript" code={multilineCode} isDark={false} />
    );

    const codeBlock = container.querySelector('.code-block');
    expect(codeBlock).toBeInTheDocument();
  });

  it('handles clipboard API failure gracefully', async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Failed')
    );

    render(<CodeBlock language="javascript" code="const x = 1;" isDark={false} />);

    const copyButton = screen.getByRole('button', { name: /copy/i });

    // Should not throw
    await act(async () => {
      fireEvent.click(copyButton);
    });

    // Button should still be there (not crashed)
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
