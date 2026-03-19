import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Cpu, User, Copy, Check } from 'lucide-react';
import type { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  isGenerating: boolean;
  isLast: boolean;
}

const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');
  
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="code-block-wrapper">
        <div className="code-block-header">
          <span className="code-lang">{language}</span>
          <button className="copy-btn" onClick={handleCopy} title="Copy code">
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        <SyntaxHighlighter
          {...props}
          style={vscDarkPlus as any}
          language={language}
          PreTag="div"
          className="syntax-highlighter-container"
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  return <code {...props} className={className}>{children}</code>;
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isGenerating, isLast }) => {
  const isAi = message.role === 'assistant';
  const [copied, setCopied] = useState(false);

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`message-wrapper ${message.role}`}>
      <div className={`avatar ${isAi ? 'ai' : ''}`}>
        {isAi ? <Cpu size={20} /> : <User size={20} />}
      </div>
      <div className={`message-bubble ${isAi ? 'ai-content' : ''}`}>
        {message.image && (
          <img src={message.image} alt="User Upload" className="message-image" />
        )}
        {isAi ? (
          <>
            <div className="message-actions">
              <button className="copy-btn msg-copy-btn" onClick={handleCopyMessage} title="Copy response">
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? '已拷贝' : '拷贝'}
              </button>
            </div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{ code: CodeBlock as any }}
            >
              {message.content + (isGenerating && isLast ? ' ▎' : '')}
            </ReactMarkdown>
          </>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
        )}
      </div>
    </div>
  );
};
