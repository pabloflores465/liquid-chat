import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Sidebar } from './Sidebar';
import { Conversation } from '../types/electron';

describe('Sidebar', () => {
  const mockConversations: Conversation[] = [
    {
      id: 'conv-1',
      title: 'First Chat',
      messages: [],
      createdAt: Date.now() - 1000,
      updatedAt: Date.now() - 1000,
    },
    {
      id: 'conv-2',
      title: 'Second Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ];

  const defaultProps = {
    conversations: mockConversations,
    currentConversationId: 'conv-1',
    theme: 'system' as const,
    onNewChat: vi.fn(),
    onSelectConversation: vi.fn(),
    onDeleteConversation: vi.fn(),
    onRenameConversation: vi.fn(),
    onCycleTheme: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app title', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('Liquid Chat')).toBeInTheDocument();
  });

  it('renders new chat button', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByRole('button', { name: /new/i })).toBeInTheDocument();
  });

  it('calls onNewChat when clicking new chat button', async () => {
    const onNewChat = vi.fn();
    render(<Sidebar {...defaultProps} onNewChat={onNewChat} />);

    const newChatButton = screen.getByRole('button', { name: /new/i });
    await userEvent.click(newChatButton);

    expect(onNewChat).toHaveBeenCalled();
  });

  it('renders all conversations', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText('First Chat')).toBeInTheDocument();
    expect(screen.getByText('Second Chat')).toBeInTheDocument();
  });

  it('highlights the current conversation', () => {
    const { container } = render(<Sidebar {...defaultProps} />);

    const activeItem = container.querySelector('.conversation-item.active');
    expect(activeItem).toBeInTheDocument();
    expect(activeItem?.textContent).toContain('First Chat');
  });

  it('calls onSelectConversation when clicking a conversation', async () => {
    const onSelectConversation = vi.fn();
    render(<Sidebar {...defaultProps} onSelectConversation={onSelectConversation} />);

    await userEvent.click(screen.getByText('Second Chat'));

    expect(onSelectConversation).toHaveBeenCalledWith('conv-2');
  });

  it('shows action buttons on hover', async () => {
    const { container } = render(<Sidebar {...defaultProps} />);

    const editButtons = container.querySelectorAll('.conversation-edit');
    const deleteButtons = container.querySelectorAll('.conversation-delete');
    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });

  it('calls onDeleteConversation when clicking delete', async () => {
    const onDeleteConversation = vi.fn();
    const { container } = render(<Sidebar {...defaultProps} onDeleteConversation={onDeleteConversation} />);

    const deleteButtons = container.querySelectorAll('.conversation-delete');
    await userEvent.click(deleteButtons[0]);

    expect(onDeleteConversation).toHaveBeenCalledWith('conv-1');
  });

  it('prevents event propagation when deleting', async () => {
    const onDeleteConversation = vi.fn();
    const onSelectConversation = vi.fn();
    const { container } = render(
      <Sidebar
        {...defaultProps}
        onDeleteConversation={onDeleteConversation}
        onSelectConversation={onSelectConversation}
      />
    );

    const deleteButtons = container.querySelectorAll('.conversation-delete');
    await userEvent.click(deleteButtons[0]);

    expect(onDeleteConversation).toHaveBeenCalled();
    // onSelectConversation should NOT be called because we stopped propagation
    expect(onSelectConversation).not.toHaveBeenCalled();
  });

  it('renders theme toggle button', () => {
    render(<Sidebar {...defaultProps} />);

    expect(screen.getByText(/system theme/i)).toBeInTheDocument();
  });

  it('calls onCycleTheme when clicking theme toggle', async () => {
    const onCycleTheme = vi.fn();
    render(<Sidebar {...defaultProps} onCycleTheme={onCycleTheme} />);

    const themeButton = screen.getByText(/system theme/i);
    await userEvent.click(themeButton);

    expect(onCycleTheme).toHaveBeenCalled();
  });

  it('shows correct theme label for light theme', () => {
    render(<Sidebar {...defaultProps} theme="light" />);

    expect(screen.getByText(/light theme/i)).toBeInTheDocument();
  });

  it('shows correct theme label for dark theme', () => {
    render(<Sidebar {...defaultProps} theme="dark" />);

    expect(screen.getByText(/dark theme/i)).toBeInTheDocument();
  });

  it('renders empty state when no conversations', () => {
    render(<Sidebar {...defaultProps} conversations={[]} />);

    const conversationsList = document.querySelector('.conversations-list');
    expect(conversationsList?.children.length).toBe(0);
  });

  it('enters edit mode on clicking edit button', async () => {
    const { container } = render(<Sidebar {...defaultProps} />);

    const editButtons = container.querySelectorAll('.conversation-edit');
    await userEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue('First Chat');
    expect(input).toBeInTheDocument();
  });

  it('enters edit mode on double-click', async () => {
    render(<Sidebar {...defaultProps} />);

    const conversationTitle = screen.getByText('First Chat');
    await userEvent.dblClick(conversationTitle);

    const input = screen.getByDisplayValue('First Chat');
    expect(input).toBeInTheDocument();
  });

  it('calls onRenameConversation when submitting new title', async () => {
    const onRenameConversation = vi.fn();
    const { container } = render(<Sidebar {...defaultProps} onRenameConversation={onRenameConversation} />);

    const editButtons = container.querySelectorAll('.conversation-edit');
    await userEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue('First Chat');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed Chat{Enter}');

    expect(onRenameConversation).toHaveBeenCalledWith('conv-1', 'Renamed Chat');
  });

  it('cancels edit mode on Escape', async () => {
    const { container } = render(<Sidebar {...defaultProps} />);

    const editButtons = container.querySelectorAll('.conversation-edit');
    await userEvent.click(editButtons[0]);

    const input = screen.getByDisplayValue('First Chat');
    await userEvent.type(input, 'New Title{Escape}');

    expect(screen.getByText('First Chat')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('New Title')).not.toBeInTheDocument();
  });
});
