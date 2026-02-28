'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: { source: string; score: number }[];
}

interface KnowledgeBase {
  id: string;
  name: string;
  chunkCount: number;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [selectedKb, setSelectedKb] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchKnowledgeBases = async () => {
    try {
      const res = await fetch('/api/upload');
      const data = await res.json();
      setKnowledgeBases(data.knowledgeBases || []);
      if (data.knowledgeBases?.length > 0) {
        setSelectedKb(data.knowledgeBases[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge bases:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !selectedKb || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          knowledgeBaseId: selectedKb,
        }),
      });
      const data = await res.json();

      if (data.response) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response,
            sources: data.sources,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Error: ' + data.error },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Error: ' + err.message },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Knowledge Base
        </label>
        <select
          value={selectedKb}
          onChange={(e) => setSelectedKb(e.target.value)}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
        >
          <option value="">-- Select Knowledge Base --</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name} ({kb.chunkCount} chunks)
            </option>
          ))}
        </select>
      </div>

      <div className="h-64 overflow-y-auto bg-slate-900/50 rounded-lg p-4 mb-4">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center">Upload documents and start chatting...</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`chat-message ${msg.role}`}>
              <p>{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-600 text-xs text-gray-300">
                  <p className="font-semibold mb-1">Sources:</p>
                  {msg.sources.map((src, j) => (
                    <p key={j}>• {src.source} (relevance: {(src.score * 100).toFixed(1)}%)</p>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        {loading && (
          <div className="chat-message assistant">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question..."
          disabled={!selectedKb || loading}
          className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!selectedKb || loading || !input.trim()}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}