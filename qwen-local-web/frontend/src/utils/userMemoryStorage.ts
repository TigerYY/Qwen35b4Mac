import type { UserMemory } from '../types';
import { USER_MEMORY_STORAGE_KEY } from '../types';

export function loadUserMemory(): UserMemory | null {
  try {
    const raw = localStorage.getItem(USER_MEMORY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserMemory;
  } catch {
    return null;
  }
}

export function saveUserMemory(memory: UserMemory): void {
  try {
    localStorage.setItem(USER_MEMORY_STORAGE_KEY, JSON.stringify(memory));
  } catch (e) {
    console.warn('Failed to save user memory', e);
  }
}

/** Format user memory for injection into system prompt. Only when enabled. */
export function formatUserMemoryForPrompt(memory: UserMemory | null): string {
  if (!memory?.enabled) return '';
  const parts: string[] = [];
  if (memory.languagePreference) parts.push(`偏好语言: ${memory.languagePreference}`);
  if (memory.outputFormat) parts.push(`输出格式: ${memory.outputFormat}`);
  if (memory.customContext) parts.push(`用户说明: ${memory.customContext}`);
  if (parts.length === 0) return '';
  return '\n\n【用户长期偏好】\n' + parts.join('\n');
}
