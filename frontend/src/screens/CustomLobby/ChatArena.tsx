import { useState, useRef, useEffect, useCallback } from 'react';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { useSocket, useRealtimeEvent } from '../../providers/RealtimeProvider';
import { Smile, Send } from 'lucide-react';
import { GlowPanel } from '../../components/shared/GlowPanel';

interface ChatMessage {
  userId: string;
  username: string;
  message: string;
  timestamp: string;
}

export function ChatArena({ lobbyId, currentUserId, participants }: { lobbyId: string; currentUserId: string; participants?: { userId: string, username: string }[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = sessionStorage.getItem(`chat_${lobbyId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [inputText, setInputText] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socket = useSocket();

  useEffect(() => {
    sessionStorage.setItem(`chat_${lobbyId}`, JSON.stringify(messages));
  }, [messages, lobbyId]);

  const handleIncomingMessage = useCallback((msg: ChatMessage) => {
    setMessages(prev => [...prev, msg]);
  }, []);

  useRealtimeEvent('custom_lobby_chat_message', handleIncomingMessage);

  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  useRealtimeEvent('custom_lobby_chat_typing', (payload) => {
    const name = payload.username || participants?.find(p => p.userId === payload.userId)?.username || 'Someone';
    setTypingUsers(prev => {
      const next = new Set(prev);
      if (payload.isTyping) next.add(name);
      else next.delete(name);
      return next;
    });
  });

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleInputChange = (val: string) => {
    setInputText(val);
    if (socket) {
      socket.emit('custom_lobby_chat_typing', { lobbyId, isTyping: true });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('custom_lobby_chat_typing', { lobbyId, isTyping: false });
      }, 2000);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  const handleSend = () => {
    if (!inputText.trim() || !socket) return;
    socket.emit('custom_lobby_chat_message', { lobbyId, message: inputText });
    socket.emit('custom_lobby_chat_typing', { lobbyId, isTyping: false });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setInputText('');
    setShowEmojiPicker(false);
  };

  const onEmojiClick = (emojiObject: any) => {
    setInputText(prev => prev + emojiObject.emoji);
  };

  return (
    <GlowPanel className="flex flex-col h-full !p-0 overflow-hidden relative border-t-4 border-t-accent-primary">
      <div className="bg-bg-panel-raised p-4 border-b border-border-hairline flex items-center justify-between">
        <h3 className="font-mono text-sm tracking-widest text-text-primary uppercase flex items-center gap-2">
          <span className="text-accent-primary">✦</span> ARENA CHAT
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-void/50">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-text-secondary/50 font-mono text-xs uppercase tracking-widest">
            Send a message to start chatting...
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.userId === currentUserId;
            return (
              <div key={idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] uppercase tracking-wider ${isMe ? 'text-accent-primary' : 'text-text-secondary'}`}>
                    {msg.username}
                  </span>
                  <span className="text-[9px] text-text-secondary/60">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className={`px-4 py-2 rounded-xl text-sm max-w-[85%] break-words ${isMe ? 'bg-accent-primary text-bg-void rounded-tr-sm' : 'bg-bg-panel-raised text-text-primary border border-border-hairline rounded-tl-sm'}`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 mb-2 text-text-secondary text-xs italic">
            <span className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-accent-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
            {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-bg-panel-raised border-t border-border-hairline relative">
        {showEmojiPicker && (
          <div className="absolute bottom-20 left-4 z-50 shadow-2xl">
            <EmojiPicker 
              onEmojiClick={onEmojiClick} 
              theme={Theme.DARK} 
              emojiStyle={EmojiStyle.NATIVE}
              lazyLoadEmojis={true}
            />
          </div>
        )}
        <form 
          className="flex items-center gap-2"
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        >
          <button 
            type="button" 
            className="p-2 text-text-secondary hover:text-accent-primary transition-colors bg-bg-void rounded"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile size={18} />
          </button>
          
          <input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            className="flex-1 bg-bg-void text-text-primary px-4 py-2 rounded border border-border-hairline focus:border-accent-primary outline-none text-sm transition-colors"
          />
          
          <button 
            type="submit" 
            disabled={!inputText.trim()}
            className="p-2 bg-accent-primary text-bg-void rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-opacity-90 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </GlowPanel>
  );
}
