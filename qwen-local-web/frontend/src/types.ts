export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string; // base64 string
  id?: string;
  createdAt?: number;
  searchMeta?: unknown;
  memoryMeta?: unknown;
}

export interface Conversation {
  id: string;
  title: string;
  summary?: string;
  messages: Message[];
  topicTags?: string[];
  createdAt: number;
  updatedAt: number;
}

export const DEFAULT_SYSTEM_PROMPT: Message = {
  role: 'system',
  content: '你是一个乐于助人、严谨的高级开发工程师和架构师助手。请始终使用 Markdown 格式回答。'
};

/** Search provider preference: auto (by query), overseas first, or domestic first */
export type SearchProviderPreference = 'auto' | 'overseasFirst' | 'domesticFirst';

export const CONVERSATIONS_STORAGE_KEY = 'chat_conversations';
export const LEGACY_MESSAGES_KEY = 'chat_messages';

/**
 * Session-level memory: each conversation has an optional summary, updated periodically
 * by the local model. Used to keep context when message count is large (summary + last K messages).
 *
 * Global long-term memory: optional user preferences (language, output format, etc.).
 * Stored separately; can be injected into system prompt when enabled. User should be able
 * to view, edit, and disable. Not persisted in conversation data.
 */
export const USER_MEMORY_STORAGE_KEY = 'chat_user_memory';

export interface UserMemory {
  /** e.g. "中文" / "English" */
  languagePreference?: string;
  /** e.g. "Markdown" / "plain" */
  outputFormat?: string;
  /** User-editable notes for the model */
  customContext?: string;
  /** If false, global memory is not injected into prompts */
  enabled?: boolean;
}
