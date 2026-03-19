import { useRef, useEffect, useState } from 'react';
import { Send, Image as ImageIcon, X, Cpu, MessageSquarePlus, Trash2, Pencil } from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import { ChatMessage } from './ChatMessage';
import type { Message, SearchProviderPreference, Conversation } from '../types';

interface ChatLayoutProps {
  conversations: Conversation[];
  activeConversationId: string;
  messages: Message[];
  isGenerating: boolean;
  onSendMessage: (text: string, image?: string) => void;
  onStopGeneration?: () => void;
  onNewConversation?: () => void;
  onSwitchConversation?: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onDeleteConversation?: (id: string) => void;
  isAgentEnabled?: boolean;
  onToggleAgent?: () => void;
  searchProviderPreference?: SearchProviderPreference;
  onSearchProviderPreferenceChange?: (v: SearchProviderPreference) => void;
  searchStatus?: string | null;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ 
  conversations,
  activeConversationId,
  messages, 
  isGenerating, 
  onSendMessage, 
  onStopGeneration,
  onNewConversation,
  onSwitchConversation,
  onRenameConversation,
  onDeleteConversation,
  isAgentEnabled,
  onToggleAgent,
  searchProviderPreference = 'auto',
  onSearchProviderPreferenceChange,
  searchStatus
}) => {
  const [inputText, setInputText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  const startRename = (c: Conversation) => {
    setEditingId(c.id);
    setEditingTitle(c.title);
  };
  const submitRename = () => {
    if (editingId && editingTitle.trim() && onRenameConversation) {
      onRenameConversation(editingId, editingTitle.trim());
      setEditingId(null);
    }
  };

  // Filter messages for display
  const displayMessages = messages.filter(m => m.role !== 'system');

  // Auto-scroll logic (smart)
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const checkScrollPosition = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    if (scrollHeight - scrollTop - clientHeight > 100) {
      setIsUserScrolledUp(true);
    } else {
      setIsUserScrolledUp(false);
    }
  };

  useEffect(() => {
    if (!isUserScrolledUp) {
      scrollToBottom();
    }
  }, [messages, isGenerating, isUserScrolledUp]);

  const handleSend = () => {
    if ((!inputText.trim() && !imagePreview) || isGenerating) return;
    
    onSendMessage(inputText.trim(), imagePreview || undefined);
    setInputText('');
    setImagePreview(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === 'ArrowUp' && !inputText) {
      e.preventDefault();
      // Find last user message
      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        setInputText(lastUserMsg.content);
        if (lastUserMsg.image) {
          setImagePreview(lastUserMsg.image);
        }
      }
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) processFile(file);
        break; // Process only first image
      }
    }
  };

  const removeImage = () => {
    setImagePreview(null);
  };

  return (
    <div 
      className="app-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Sidebar: topics */}
      <aside className="sidebar">
        <button type="button" className="sidebar-new-btn" onClick={onNewConversation} title="新话题">
          <MessageSquarePlus size={20} />
          <span>新话题</span>
        </button>
        <ul className="sidebar-list">
          {conversations.map((c) => (
            <li key={c.id} className={`sidebar-item ${c.id === activeConversationId ? 'active' : ''}`}>
              {editingId === c.id ? (
                <input
                  className="sidebar-edit-input"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setEditingId(null); }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <button
                    type="button"
                    className="sidebar-item-btn"
                    onClick={() => onSwitchConversation?.(c.id)}
                  >
                    <span className="sidebar-item-title" title={c.title}>{c.title}</span>
                  </button>
                  <div className="sidebar-item-actions">
                    {onRenameConversation && (
                      <button type="button" className="sidebar-icon-btn" title="重命名" onClick={(e) => { e.stopPropagation(); startRename(c); }}>
                        <Pencil size={14} />
                      </button>
                    )}
                    {onDeleteConversation && (
                      <button type="button" className="sidebar-icon-btn" title="删除" onClick={(e) => { e.stopPropagation(); onDeleteConversation(c.id); }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </aside>

      <div className="app-main">
      {/* Drag overlay */}
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            <ImageIcon size={48} />
            <h2>Drop to attach image</h2>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="app-header">
        <div className="model-badge">Qwen 3.5 (35B-A3B-4bit)</div>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          MLX Local Runtime
        </div>
      </header>

      {/* Chat Messages Area */}
      <main className="chat-messages" ref={messagesContainerRef} onScroll={checkScrollPosition}>
        {searchStatus && (
          <div className="message-wrapper ai">
            <div className="avatar ai"><Cpu size={20} /></div>
            <div className="message-bubble" style={{ color: 'var(--accent-color)', fontStyle: 'italic', fontSize: '0.9rem' }}>
              {searchStatus}
            </div>
          </div>
        )}
        {displayMessages.map((msg, index) => (
          <ChatMessage 
            key={index}
            message={msg}
            isGenerating={isGenerating}
            isLast={index === displayMessages.length - 1} 
          />
        ))}
        {isGenerating && !searchStatus && (
          <div className="message-wrapper ai">
            <div className="avatar ai"><Cpu size={20} /></div>
            <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="typing-indicator" style={{ display: 'inline-flex' }}>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
                <div className="typing-dot"></div>
              </div>
              {onStopGeneration && (
                <button className="stop-btn" onClick={onStopGeneration}>
                  ⏹ 中止生成
                </button>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>
      
      {/* Scroll to bottom floating button */}
      {isUserScrolledUp && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          ↓ 最新消息
        </button>
      )}

      {/* Input Area */}
      <footer className="input-container">
        {isGenerating && (
          <div className="input-status-bar" role="status">
            {searchStatus || '正在处理…'}
          </div>
        )}
        <div className="input-box">
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', padding: '0 0.5rem', flexWrap: 'wrap' }}>
            {onToggleAgent && (
               <button 
                 onClick={onToggleAgent}
                 className={`agent-toggle-btn ${isAgentEnabled ? 'active' : ''}`}
                 title="Toggle Smart Web Search Agent"
               >
                 <span className="dot"></span>
                 🌐 联网模式 {isAgentEnabled ? 'ON' : 'OFF'}
               </button>
            )}
            {isAgentEnabled && onSearchProviderPreferenceChange && (
              <select
                className="search-provider-select"
                value={searchProviderPreference}
                onChange={(e) => onSearchProviderPreferenceChange(e.target.value as SearchProviderPreference)}
                title="搜索源：自动 / 海外优先 / 国内优先"
              >
                <option value="auto">搜索：自动</option>
                <option value="overseasFirst">海外优先</option>
                <option value="domesticFirst">国内优先</option>
              </select>
            )}
          </div>
          {imagePreview && (
            <div className="preview-area">
              <div className="image-preview">
                <img src={imagePreview} alt="Preview" />
                <button className="remove-btn" onClick={removeImage}>
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
          
          <div className="input-row">
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload}
            />
            <button 
              className="action-btn" 
              onClick={() => fileInputRef.current?.click()}
              disabled={isGenerating}
              title="Upload Image (Base64)"
            >
              <ImageIcon size={22} />
            </button>
            <TextareaAutosize
              minRows={1}
              maxRows={6}
              placeholder="发消息、使用 Shift+Enter 换行，或粘贴图片..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={isGenerating}
              className="auto-resize-textarea"
            />
            <button 
              className="action-btn send" 
              onClick={handleSend}
              disabled={isGenerating || (!inputText.trim() && !imagePreview)}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </footer>
      </div>
    </div>
  );
};
