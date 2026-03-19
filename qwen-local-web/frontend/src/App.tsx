import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatLayout } from './components/ChatLayout';
import type { Message, SearchProviderPreference } from './types';
import { loadConversationsState, saveConversationsState, newConversation } from './utils/conversationStorage';
import { loadUserMemory, formatUserMemoryForPrompt } from './utils/userMemoryStorage';
import { searchWeb, formatSearchResults, formatSearchSources } from './utils/search';
import type { SearchResult } from './utils/search';

// Connect out to the local MLX server dynamically
// Vite will inject __BACKEND_PORT__ during build/dev
declare const __BACKEND_PORT__: string;
const defaultPort = typeof __BACKEND_PORT__ !== 'undefined' ? __BACKEND_PORT__ : '8080';
const API_URL = `http://localhost:${defaultPort}/v1/chat/completions`;
const MODEL_NAME = '/Users/yangyang/Documents/YYLLM/qwen-local-web/models--mlx-community--Qwen3.5-35B-A3B-4bit/snapshots/1e20fd8d42056f870933bf98ca6211024744f7ec';

const SUMMARY_CONTEXT_THRESHOLD = 14; // use conversation summary when message count exceeds this
const LAST_K_MESSAGES = 10; // when using summary, send only last K messages
const SUMMARY_UPDATE_AFTER = 8; // update conversation summary after this many messages

async function synthesizeSearchSummary(
  apiHost: string,
  rawEvidence: string,
  userQuery: string
): Promise<string> {
  const res = await fetch(apiHost, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-local-no-key'
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: '你是一个检索结果整理助手。根据下列网络检索结果，输出一份简洁的「检索摘要」：关键事实、时间性；若有冲突或不确定处请标明。若结果中表明某产品/人物/事件不存在、或未找到相关信息，必须在摘要中明确写出「未找到」或「该产品/事物不存在」。最后列出来源（标题与链接）。不要编造，只基于给定内容。用 Markdown 格式。'
        },
        {
          role: 'user',
          content: rawEvidence + '\n\n用户问题：' + userQuery
        }
      ],
      temperature: 0.3,
      max_tokens: 1024,
      stream: false
    })
  });
  if (!res.ok) throw new Error(`Synthesis failed: ${res.status}`);
  const data = await res.json();
  const summary = data.choices?.[0]?.message?.content?.trim() ?? '';
  return summary || rawEvidence;
}

async function synthesizeConversationSummary(apiHost: string, messages: Message[]): Promise<string> {
  const display = messages.filter(m => m.role !== 'system').slice(-12);
  const text = display.map(m => `${m.role}: ${m.content.slice(0, 300)}${m.content.length > 300 ? '...' : ''}`).join('\n\n');
  const res = await fetch(apiHost, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-local-no-key'
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: '请用 2～4 句话概括上述对话的主题与关键结论，用于后续对话的上下文延续。不要编造。'
        },
        { role: 'user', content: text }
      ],
      temperature: 0.2,
      max_tokens: 256,
      stream: false
    })
  });
  if (!res.ok) throw new Error(`Summary failed: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

function App() {
  const [state, setState] = useState(loadConversationsState);
  const { conversations, activeId } = state;
  const activeConversation = conversations.find(c => c.id === activeId);
  const messages = activeConversation?.messages ?? [];

  const setMessages = useCallback((updater: Message[] | ((prev: Message[]) => Message[])) => {
    setState(prev => {
      const targetId = requestConvIdRef.current ?? prev.activeId;
      const list = prev.conversations.map(c => {
        if (c.id !== targetId) return c;
        const next = typeof updater === 'function' ? updater(c.messages) : updater;
        return {
          ...c,
          messages: next,
          updatedAt: Date.now()
        };
      });
      return { ...prev, conversations: list };
    });
  }, []);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAgentEnabled, setIsAgentEnabled] = useState(false);
  const [searchProviderPreference, setSearchProviderPreference] = useState<SearchProviderPreference>('auto');
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  /** 当前请求所属话题 ID，确保回复/错误始终落在发送时的话题上 */
  const requestConvIdRef = useRef<string | null>(null);
  const [apiHost, setApiHost] = useState(API_URL);

  useEffect(() => {
    const hostname = window.location.hostname;
    setApiHost(`http://${hostname}:${defaultPort}/v1/chat/completions`);
  }, []);

  useEffect(() => {
    saveConversationsState(state);
  }, [state]);

  const handleNewConversation = useCallback(() => {
    const conv = newConversation();
    setState(prev => ({
      conversations: [conv, ...prev.conversations],
      activeId: conv.id
    }));
  }, []);

  const handleSwitchConversation = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeId: id }));
  }, []);

  const handleRenameConversation = useCallback((id: string, title: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(c => c.id === id ? { ...c, title, updatedAt: Date.now() } : c)
    }));
  }, []);

  const handleDeleteConversation = useCallback((id: string) => {
    setState(prev => {
      const list = prev.conversations.filter(c => c.id !== id);
      let nextActiveId = prev.activeId;
      if (prev.activeId === id) {
        if (list.length > 0) nextActiveId = list[0].id;
        else {
          const newConv = newConversation();
          list.push(newConv);
          nextActiveId = newConv.id;
        }
      }
      return { conversations: list, activeId: nextActiveId };
    });
  }, []);

  const handleUpdateConversationSummary = useCallback((convId: string, summary: string) => {
    setState(prev => ({
      ...prev,
      conversations: prev.conversations.map(c =>
        c.id === convId ? { ...c, summary, updatedAt: Date.now() } : c
      )
    }));
  }, []);

  const wasGeneratingRef = useRef(false);
  useEffect(() => {
    if (wasGeneratingRef.current && !isGenerating && activeId && messages.length >= SUMMARY_UPDATE_AFTER) {
      const conv = conversations.find(c => c.id === activeId);
      if (conv && conv.messages.length >= SUMMARY_UPDATE_AFTER) {
        synthesizeConversationSummary(apiHost, conv.messages)
          .then((summary) => handleUpdateConversationSummary(activeId, summary))
          .catch(() => {});
      }
    }
    wasGeneratingRef.current = isGenerating;
  }, [isGenerating, activeId, conversations, apiHost, handleUpdateConversationSummary, messages.length]);

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  };

  const handleSendMessage = async (text: string, imageBase64?: string) => {
    const userMessage: Message = {
      role: 'user',
      content: text,
      image: imageBase64
    };

    requestConvIdRef.current = activeId;
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsGenerating(true);
    setSearchStatus(null);

    let injectedContext = '';

    try {
      if (isAgentEnabled && !imageBase64) {
        try {
          setSearchStatus('🔍 正在智能分析意图...');
          const intentPayload = [
            {
              role: 'system',
              content: '你是一个意图分类路由器。若用户的提问需要检索当前最新的实时信息、新闻、或需要查证互联网上的事实（例如现实中已发生的事件、新闻、某产品/品牌/人物是否存在或最新情况、是否真实、是否适合、推荐与否等），请且仅输出 "YES"。仅当问题纯属通用知识、数学、编程语法等无需查证时输出 "NO"。'
            },
            { role: 'user', content: text }
          ];

          const fastKeywords = [
            '天气', '股价', '股票', '汇率', '新闻', '最新', '今天', '明天', '今年', '谁是',
            '适合', '存在', '有没有', '推荐', '怎么样', '好用', '值得', '是否', '是不是', '真的',
            '事件', '进展', '发生', '报道', '信息', '最新消息', '怎么回事', '真的吗', '什么时候'
          ];
          let needsSearch = fastKeywords.some(kw => text.includes(kw));

          if (!needsSearch) {
            const intentResponse = await fetch(apiHost, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer sk-local-no-key'
              },
              body: JSON.stringify({
                model: MODEL_NAME,
                messages: intentPayload,
                temperature: 0.1,
                max_tokens: 500
              })
            });

            if (intentResponse.ok) {
              const intentData = await intentResponse.json();
              const content = intentData.choices?.[0]?.message?.content?.trim().toUpperCase() || 'NO';
              needsSearch = /YES[^A-Z]*$/.test(content);
            }
          }

          if (needsSearch) {
            setSearchStatus(`🌐 正在检索「${text.substring(0, 10)}${text.length > 10 ? '...' : ''}」...`);
            const results: SearchResult[] = await searchWeb(text, searchProviderPreference);
            if (results.length > 0) {
              const rawEvidence = formatSearchResults(results);
              setSearchStatus('📝 正在整理检索内容...');
              let searchSummary: string;
              try {
                searchSummary = await synthesizeSearchSummary(apiHost, rawEvidence, text);
              } catch {
                searchSummary = rawEvidence;
              }
              const sourcesBlock = formatSearchSources(results);
              injectedContext =
                '【检索摘要】\n' +
                searchSummary +
                (sourcesBlock ? '\n\n【来源】\n' + sourcesBlock : '') +
                '\n\n【重要系统指令】请严格基于上述检索摘要与来源回答。若摘要或来源表明某产品/人物/事件不存在或未找到相关信息，请明确告知用户「检索未找到」或「该产品/事物不存在」，不要臆测。不要声明自己无法联网。\n用户问题：\n';
            } else {
              injectedContext =
                '【网络检索】已尝试 Sogou 与 DuckDuckGo，均未解析到有效结果；可能是网络、反爬或页面改版导致。请根据你的知识回答。若问题涉及具体产品/品牌/人物是否存在，请明确说明：检索未找到依据，该名称可能不是已公开存在的产品或人物，并建议用户换问法或稍后重试。\n用户问题：\n';
            }
          }
        } catch (searchOrIntentError) {
          console.warn('联网意图/检索阶段失败，将不注入检索结果继续回答', searchOrIntentError);
          injectedContext = '';
        }
      }

      setSearchStatus(null);

      // Session memory: when conversation has a summary and many messages, send summary + last K
      const useSummary = Boolean(activeConversation?.summary && newMessages.length > SUMMARY_CONTEXT_THRESHOLD);
      const systemMsg = newMessages.find(m => m.role === 'system');
      const nonSystem = newMessages.filter(m => m.role !== 'system');
      const userMemoryBlock = formatUserMemoryForPrompt(loadUserMemory());
      const systemContent =
        (systemMsg?.content ?? '') +
        (useSummary && activeConversation?.summary ? '\n\n【此前对话摘要】\n' + activeConversation.summary : '') +
        userMemoryBlock;

      let messagesForPayload: Array<{ role: 'user' | 'assistant' | 'system'; content: string } | { role: 'user'; content: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> }>;
      if (useSummary) {
        messagesForPayload = [
          { role: 'system' as const, content: systemContent },
          ...nonSystem.slice(-LAST_K_MESSAGES)
        ];
      } else {
        const withSystem = systemMsg
          ? [{ role: 'system' as const, content: systemContent }, ...nonSystem]
          : newMessages.map(m => (m.role === 'system' ? { ...m, content: systemContent } : m));
        messagesForPayload = withSystem as typeof messagesForPayload;
      }

      // Build OpenAI compatible payload
      const payloadMessages = messagesForPayload.map((msg, idx) => {
        const isLastUser = idx === messagesForPayload.length - 1 && msg.role === 'user';
        let contentToUse = typeof msg.content === 'string' ? msg.content : '';
        if (isLastUser && injectedContext) contentToUse = injectedContext + contentToUse;

        if (msg.role === 'user' && (msg as Message).image) {
          return {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: contentToUse },
              { type: 'image_url' as const, image_url: { url: (msg as Message).image! } }
            ]
          };
        }
        return { role: msg.role, content: contentToUse };
      });

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const response = await fetch(apiHost, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-local-no-key' // Dummy key
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          messages: payloadMessages,
          temperature: 0.7,
          stream: true,
          max_tokens: 4096
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) throw new Error("No reader available");

      // Add a placeholder assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      let done = false;
      let aiContent = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkString = decoder.decode(value, { stream: true });
          const lines = chunkString.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                const delta = data.choices[0]?.delta?.content || '';
                aiContent += delta;
                
                // Update the last message
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: aiContent
                  };
                  return updated;
                });
              } catch (e) {
                console.error("Error parsing stream chunk", e);
              }
            }
          }
        }
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages(prev => [...prev, { role: 'assistant', content: '*已中止生成*' }]);
      } else {
        console.error(error);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `**发生错误：** 无法连接到本地 MLX 服务或请求失败。请确保 \`start_backend.sh\` 已运行。\n\n详情: ${String(error?.message ?? error)}` }
        ]);
      }
    } finally {
      setIsGenerating(false);
      setSearchStatus(null);
      abortControllerRef.current = null;
      requestConvIdRef.current = null;
    }
  };

  return (
    <ChatLayout 
      conversations={conversations}
      activeConversationId={activeId}
      messages={messages} 
      isGenerating={isGenerating} 
      onSendMessage={handleSendMessage}
      onStopGeneration={handleStopGeneration} 
      onNewConversation={handleNewConversation}
      onSwitchConversation={handleSwitchConversation}
      onRenameConversation={handleRenameConversation}
      onDeleteConversation={handleDeleteConversation}
      isAgentEnabled={isAgentEnabled}
      onToggleAgent={() => setIsAgentEnabled(!isAgentEnabled)}
      searchProviderPreference={searchProviderPreference}
      onSearchProviderPreferenceChange={setSearchProviderPreference}
      searchStatus={searchStatus}
    />
  );
}

export default App;
