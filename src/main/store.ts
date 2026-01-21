import Store from 'electron-store';
import { Conversation, AppSettings } from './types.js';

interface StoreData {
  conversations: Conversation[];
  settings: AppSettings;
  currentConversationId: string | null;
}

const defaultSettings: AppSettings = {
  theme: 'system',
  modelPath: null,
};

export const store = new Store<StoreData>({
  defaults: {
    conversations: [],
    settings: defaultSettings,
    currentConversationId: null,
  },
});

export function getConversations(): Conversation[] {
  return store.get('conversations', []);
}

export function getConversation(id: string): Conversation | undefined {
  const conversations = getConversations();
  return conversations.find((c) => c.id === id);
}

export function saveConversation(conversation: Conversation): void {
  const conversations = getConversations();
  const index = conversations.findIndex((c) => c.id === conversation.id);

  if (index >= 0) {
    conversations[index] = conversation;
  } else {
    conversations.unshift(conversation);
  }

  store.set('conversations', conversations);
}

export function deleteConversation(id: string): void {
  const conversations = getConversations();
  const filtered = conversations.filter((c) => c.id !== id);
  store.set('conversations', filtered);

  const currentId = store.get('currentConversationId');
  if (currentId === id) {
    store.set('currentConversationId', filtered[0]?.id ?? null);
  }
}

export function getSettings(): AppSettings {
  return store.get('settings', defaultSettings);
}

export function updateSettings(settings: Partial<AppSettings>): AppSettings {
  const current = getSettings();
  const updated = { ...current, ...settings };
  store.set('settings', updated);
  return updated;
}

export function getCurrentConversationId(): string | null {
  return store.get('currentConversationId', null);
}

export function setCurrentConversationId(id: string | null): void {
  store.set('currentConversationId', id);
}
