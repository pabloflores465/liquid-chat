import React, { useState, useRef, useEffect } from 'react';
import { Conversation } from '../types/electron';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  theme: 'light' | 'dark' | 'system';
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onCycleTheme: () => void;
}

const themeLabels = {
  light: 'Light',
  dark: 'Dark',
  system: 'System',
};

const themeIcons = {
  light: '(sun)',
  dark: '(moon)',
  system: '(auto)',
};

export function Sidebar({
  conversations,
  currentConversationId,
  theme,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onCycleTheme,
}: SidebarProps): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleDelete = (e: React.MouseEvent, id: string): void => {
    e.stopPropagation();
    onDeleteConversation(id);
  };

  const handleEdit = (e: React.MouseEvent, conversation: Conversation): void => {
    e.stopPropagation();
    setEditingId(conversation.id);
    setEditValue(conversation.title);
  };

  const handleRenameSubmit = (id: string): void => {
    if (editValue.trim()) {
      onRenameConversation(id, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string): void => {
    if (e.key === 'Enter') {
      handleRenameSubmit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditValue('');
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1>Liquid Chat</h1>
        <button className="new-chat-btn" onClick={onNewChat}>
          + New
        </button>
      </div>

      <div className="conversations-list">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`conversation-item ${
              conversation.id === currentConversationId ? 'active' : ''
            }`}
            onClick={() => editingId !== conversation.id && onSelectConversation(conversation.id)}
          >
            {editingId === conversation.id ? (
              <input
                ref={inputRef}
                type="text"
                className="conversation-title-input"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => handleRenameSubmit(conversation.id)}
                onKeyDown={(e) => handleKeyDown(e, conversation.id)}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className="conversation-title"
                onDoubleClick={(e) => handleEdit(e, conversation)}
              >
                {conversation.title}
              </span>
            )}
            <div className="conversation-actions">
              <button
                className="conversation-edit"
                onClick={(e) => handleEdit(e, conversation)}
                title="Rename"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </button>
              <button
                className="conversation-delete"
                onClick={(e) => handleDelete(e, conversation.id)}
                title="Delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18"/>
                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={onCycleTheme}>
          {themeIcons[theme]} {themeLabels[theme]} Theme
        </button>
      </div>
    </aside>
  );
}
