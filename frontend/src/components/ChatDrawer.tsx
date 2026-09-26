import React, { useState, useRef, useEffect } from 'react';
import { Send, X, MessageSquare } from 'lucide-react';
import { useSessionStore } from '../store/useSessionStore.js';
import { socketService } from '../services/socket.service.js';
import { ChatMessage } from '../types/index.js';

interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({ isOpen, onClose }) => {
  const { sessionId, chatMessages } = useSessionStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  if (!isOpen) return null;

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !sessionId) return;
    socketService.sendChatMessage(sessionId, inputText.trim());
    setInputText('');
  };

  return (
    <div className="w-80 h-full bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 transition-all">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-4 h-4 text-brand-600" />
          <h4 className="text-sm font-bold text-slate-800">Session Chat</h4>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
        {chatMessages.length === 0 ? (
          <div className="text-center py-10 text-xs text-slate-400">
            No messages yet. Send a message to the remote peer.
          </div>
        ) : (
          chatMessages.map((msg: ChatMessage) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
            >
              <div className="text-[10px] text-slate-400 font-medium mb-1 px-1">
                {msg.senderName}
              </div>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                  msg.isSelf
                    ? 'bg-brand-600 text-white rounded-tr-none'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-slate-200 bg-white flex space-x-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type message..."
          className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="submit"
          className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
