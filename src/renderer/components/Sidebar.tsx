import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Conversation } from '../types/electron';

interface SidebarProps {
  conversations: Conversation[];
  currentConversationId: string | null;
  generatingConversationId: string | null;
  hasMoreConversations: boolean;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onLoadMore: () => void;
}

interface SearchResult {
  conversation: Conversation;
  matchType: 'title' | 'content';
  matchPreview?: string;
}

function SearchIcon(): React.ReactElement {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="m21 21-4.3-4.3"/>
    </svg>
  );
}

function ClearIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  );
}

function SearchSpinner(): React.ReactElement {
  return (
    <div className="search-spinner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

function searchConversations(
  conversations: Conversation[],
  query: string
): SearchResult[] {
  if (!query.trim()) {
    return [];
  }

  const normalizedQuery = query.toLowerCase().trim();
  const queryTerms = normalizedQuery.split(/\s+/).filter(term => term.length > 0);
  const results: SearchResult[] = [];
  const seenIds = new Set<string>();

  // First pass: title matches (higher priority)
  for (const conversation of conversations) {
    const titleLower = conversation.title.toLowerCase();
    const titleMatches = queryTerms.every(term => titleLower.includes(term));

    if (titleMatches) {
      results.push({
        conversation,
        matchType: 'title',
      });
      seenIds.add(conversation.id);
    }
  }

  // Second pass: content matches
  for (const conversation of conversations) {
    if (seenIds.has(conversation.id)) continue;

    for (const message of conversation.messages) {
      const contentLower = message.content.toLowerCase();
      const contentMatches = queryTerms.every(term => contentLower.includes(term));

      if (contentMatches) {
        // Extract a preview snippet around the first match
        const firstTermIndex = contentLower.indexOf(queryTerms[0]);
        const start = Math.max(0, firstTermIndex - 30);
        const end = Math.min(message.content.length, firstTermIndex + queryTerms[0].length + 50);
        let preview = message.content.slice(start, end).trim();
        if (start > 0) preview = '...' + preview;
        if (end < message.content.length) preview = preview + '...';

        results.push({
          conversation,
          matchType: 'content',
          matchPreview: preview,
        });
        seenIds.add(conversation.id);
        break;
      }
    }
  }

  return results;
}

function Spinner(): React.ReactElement {
  return (
    <div className="sidebar-spinner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    </div>
  );
}

const SEARCH_DEBOUNCE_MS = 300;

export function Sidebar({
  conversations,
  currentConversationId,
  generatingConversationId,
  hasMoreConversations,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onLoadMore,
}: SidebarProps): React.ReactElement {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const performSearch = useCallback((query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const results = searchConversations(conversations, query);
    setSearchResults(results);
    setIsSearching(false);
  }, [conversations]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      performSearch(value);
    }, SEARCH_DEBOUNCE_MS);
  }, [performSearch]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  // Re-run search when conversations change (e.g., new messages)
  useEffect(() => {
    if (searchQuery.trim() && !isSearching) {
      performSearch(searchQuery);
    }
  }, [conversations, searchQuery, isSearching, performSearch]);

  const isActiveSearch = searchQuery.trim().length > 0;
  const displayConversations = isActiveSearch
    ? searchResults.map(r => r.conversation)
    : conversations;
  const searchResultsMap = new Map(searchResults.map(r => [r.conversation.id, r]));

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

      <div className={`sidebar-search ${isActiveSearch ? 'active' : ''}`}>
        {isSearching ? <SearchSpinner /> : <SearchIcon />}
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="search-input"
        />
        {isActiveSearch && (
          <button className="search-clear-btn" onClick={clearSearch} title="Clear search">
            <ClearIcon />
          </button>
        )}
      </div>

      <div className="conversations-list">
        {isSearching ? (
          <div className="search-loading">
            <SearchSpinner />
            <span>Searching...</span>
          </div>
        ) : isActiveSearch && displayConversations.length === 0 ? (
          <div className="search-no-results">
            <span>No results found</span>
          </div>
        ) : (
          displayConversations.map((conversation) => {
            const isGenerating = conversation.id === generatingConversationId;
            const searchResult = searchResultsMap.get(conversation.id);
            return (
              <div
                key={conversation.id}
                className={`conversation-item ${
                  conversation.id === currentConversationId ? 'active' : ''
                } ${isGenerating ? 'generating' : ''}`}
                onClick={() => editingId !== conversation.id && onSelectConversation(conversation.id)}
              >
                {isGenerating && <Spinner />}
                <div className="conversation-content">
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
                    <>
                      <span
                        className="conversation-title"
                        onDoubleClick={(e) => handleEdit(e, conversation)}
                      >
                        {conversation.title}
                      </span>
                      {searchResult?.matchType === 'content' && searchResult.matchPreview && (
                        <span className="conversation-match-preview">
                          {searchResult.matchPreview}
                        </span>
                      )}
                    </>
                  )}
                </div>
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
            );
          })
        )}
        {!isActiveSearch && hasMoreConversations && (
          <button className="load-more-btn" onClick={onLoadMore}>
            Load more chats
          </button>
        )}
      </div>

    </aside>
  );
}
