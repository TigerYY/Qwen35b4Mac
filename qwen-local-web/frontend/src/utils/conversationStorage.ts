import type { Conversation, Message } from '../types';
import { CONVERSATIONS_STORAGE_KEY, LEGACY_MESSAGES_KEY, DEFAULT_SYSTEM_PROMPT } from '../types';

export interface ConversationsState {
  conversations: Conversation[];
  activeId: string;
}

function genId(): string {
  return crypto.randomUUID?.() ?? `conv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function now(): number {
  return Date.now();
}

export function newConversation(): Conversation {
  const id = genId();
  const t = now();
  return {
    id,
    title: '新话题',
    messages: [{ ...DEFAULT_SYSTEM_PROMPT }],
    createdAt: t,
    updatedAt: t
  };
}

function migrateLegacyMessages(): Conversation[] {
  try {
    const raw = localStorage.getItem(LEGACY_MESSAGES_KEY);
    if (!raw) return [];
    const messages: Message[] = JSON.parse(raw);
    if (!Array.isArray(messages) || messages.length === 0) return [];
    localStorage.removeItem(LEGACY_MESSAGES_KEY);
    const conv: Conversation = {
      id: genId(),
      title: '历史对话',
      messages,
      createdAt: now(),
      updatedAt: now()
    };
    return [conv];
  } catch {
    return [];
  }
}

export function loadConversationsState(): ConversationsState {
  const migrated = migrateLegacyMessages();
  if (migrated.length > 0) {
    const state: ConversationsState = {
      conversations: migrated,
      activeId: migrated[0].id
    };
    saveConversationsState(state);
    return state;
  }
  try {
    const raw = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as ConversationsState;
    if (!parsed.conversations?.length || !parsed.activeId) return getDefaultState();
    const exists = parsed.conversations.some((c: Conversation) => c.id === parsed.activeId);
    return {
      conversations: parsed.conversations,
      activeId: exists ? parsed.activeId : parsed.conversations[0].id
    };
  } catch {
    return getDefaultState();
  }
}

function getDefaultState(): ConversationsState {
  const conv = newConversation();
  return {
    conversations: [conv],
    activeId: conv.id
  };
}

export function saveConversationsState(state: ConversationsState): void {
  try {
    localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(state));
  } catch (e: unknown) {
    if (e instanceof Error && (e.name === 'QuotaExceededError' || (e as { code?: number }).code === 22)) {
      try {
        const list = state.conversations.slice(-20);
        const activeId = list.some(c => c.id === state.activeId) ? state.activeId : list[0]?.id ?? state.activeId;
        localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify({ conversations: list, activeId }));
      } catch {
        console.error('Failed to save conversations after quota cleanup');
      }
    } else {
      console.error('Failed to save conversations', e);
    }
  }
}
