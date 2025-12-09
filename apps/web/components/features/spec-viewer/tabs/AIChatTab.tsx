'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { initializeChat, sendChatMessage, loadChatHistory, saveChatHistory, clearChatHistory, ChatMessage } from '@/lib/api/chat';
import { marked } from 'marked';
import { showNotification } from '@/components/features/spec-viewer/Notification';
import { Button } from '@/components/ui/Button';

interface AIChatTabProps {
  specId: string;
  enabled: boolean;
  specUpdatedAt?: any; // Timestamp of last spec update
}

export function AIChatTab({ specId, enabled, specUpdatedAt }: AIChatTabProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const prevUpdateRef = useRef<any>(null);

  useEffect(() => {
    if (enabled && specId && user && !initialized) {
      initChat();
    }
  }, [enabled, specId, user, initialized]);

  useEffect(() => {
    // Load chat history from localStorage
    if (specId) {
      const history = loadChatHistory(specId);
      if (history.length > 0) {
        setMessages(history);
      }
    }
  }, [specId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    scrollToBottom();
  }, [messages]);

  // Auto-reset chat when spec is updated
  useEffect(() => {
    if (!specId || !specUpdatedAt) return;

    // Check if spec was updated (compare timestamps)
    const currentUpdate = specUpdatedAt;
    const prevUpdate = prevUpdateRef.current;

    // If this is the first time or spec was updated, reset chat
    if (prevUpdate === null || (currentUpdate && currentUpdate !== prevUpdate)) {
      // Reset chat state
      clearChatHistory(specId);
      setMessages([]);
      setThreadId(null);
      setAssistantId(null);
      setInitialized(false);
      
      // Update ref
      prevUpdateRef.current = currentUpdate;
    }
  }, [specUpdatedAt, specId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initChat = async () => {
    if (!user || !specId) return;

    try {
      const result = await initializeChat(specId);
      setThreadId(result.threadId);
      setAssistantId(result.assistantId);
      setInitialized(true);
    } catch (error: any) {
      console.error('Error initializing chat:', error);
      // Don't show error - just mark as not initialized
    }
  };

  const handleSend = async () => {
    const messageText = input.trim();
    if (!messageText || loading || !user || !specId) return;

    // Add user message to UI immediately
    const userMessage: ChatMessage = {
      role: 'user',
      content: messageText,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    // Save to history
    const updatedHistory = [...messages, userMessage];
    saveChatHistory(specId, updatedHistory);

    // Initialize chat if needed
    if (!initialized || !threadId || !assistantId) {
      await initChat();
    }

    setLoading(true);

    try {
      const result = await sendChatMessage(
        specId,
        threadId!,
        assistantId!,
        messageText
      );

      // Update thread/assistant IDs if they changed
      if (result.threadId && result.threadId !== threadId) {
        setThreadId(result.threadId);
      }
      if (result.assistantId && result.assistantId !== assistantId) {
        setAssistantId(result.assistantId);
      }

      // Add assistant message (result.message or result.response)
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.message || result.response || '',
        timestamp: Date.now()
      };
      const finalHistory = [...updatedHistory, assistantMessage];
      setMessages(finalHistory);
      saveChatHistory(specId, finalHistory);
    } catch (error: any) {
      console.error('Error sending message:', error);
      // Remove user message on error
      setMessages(messages);
      showNotification(error.message || 'Failed to send message', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (!specId) return;
    
    clearChatHistory(specId);
    setMessages([]);
    setThreadId(null);
    setAssistantId(null);
    setInitialized(false);
  };

  const isRTL = (text: string): boolean => {
    const rtlChars = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    const nonWhitespaceChars = text.replace(/\s/g, '');
    if (nonWhitespaceChars.length === 0) return false;
    
    const matches = nonWhitespaceChars.match(rtlChars);
    if (matches) {
      return matches.length / nonWhitespaceChars.length > 0.5;
    }
    return false;
  };

  const handleInputChange = (value: string) => {
    setInput(value);
    // Auto-detect text direction
    if (isRTL(value)) {
      // RTL will be handled by CSS
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!enabled) {
    return (
      <div className="tab-content" id="chat-content">
        <div className="content-body">
          <div className="locked-tab-message">
            <h3><i className="fa fa-lock"></i> AI Chat</h3>
            <p>Please approve the Overview first to enable AI Chat.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content" id="chat-content">
      <div className="chat-container">
        <div className="chat-header">
          <div>
            <h2>
              <i className="fa fa-comments"></i> AI Chat Assistant
            </h2>
            <p className="chat-subtitle">
              Ask questions about your specification
            </p>
          </div>
          <Button
            onClick={handleReset}
            
          >
            <i className="fa fa-refresh"></i> Reset Chat
          </Button>
        </div>

        <div
          ref={messagesContainerRef}
          id="chat-messages"
          className="chat-messages"
         
        >
          {messages.length === 0 ? (
            <div className="chat-welcome">
              <i className="fa fa-comments"></i>
              <h3>Welcome to AI Chat</h3>
              <p>
                Ask me anything about your specification. I have access to all the details and can help clarify, explain, or suggest improvements.
              </p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isRTLText = isRTL(msg.content);
              return (
                <div
                  key={index}
                  className={`chat-message ${msg.role}`}
                >
                  <div
                    className="chat-message-bubble"
                    dir={isRTLText ? 'rtl' : 'ltr'}
                    dangerouslySetInnerHTML={{ __html: marked.parse(msg.content) as string }}
                  />
                  <div className="chat-message-time">
                    {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
                  </div>
                </div>
              );
            })
          )}
          {loading && (
            <div className="chat-message assistant">
              <div className="chat-loading">
                <span>AI is thinking...</span>
                <div className="chat-loading-dots">
                  <div className="chat-loading-dot"></div>
                  <div className="chat-loading-dot"></div>
                  <div className="chat-loading-dot"></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-container">
          <textarea
            id="chat-input"
            className="chat-input"
            placeholder="Ask a question about your spec..."
            rows={2}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <Button
            id="send-chat-btn"
            
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="chat-send-btn"
          >
            <i className="fa fa-paper-plane"></i> Send
          </Button>
        </div>
      </div>
    </div>
  );
}

