'use client';

import { useState, useRef, useEffect } from 'react';
import type { AIChatMessage } from '@/types';

const QUICK_PROMPTS = [
  '🎯 Reklamlarımı optimize etmemi için öneri ver',
  '📝 Happy hour için etkileyici reklam metni yaz',
  '📊 Hangi saatlerde reklam yayınlamalıyım?',
  '🎨 Lounge için en etkili içerik stratejisi nedir?',
  '🎵 DJ night etkinliği için duyuru metni oluştur',
  '💡 Müşteri bağlılığını artıracak içerik fikirleri ver',
];

export default function AIStudioPage() {
  const [messages, setMessages] = useState<AIChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Merhaba! Ben Social Lounge TV\'nin AI asistanıyım.\n\nReklam oluşturma, içerik stratejisi, ekran yönetimi ve daha fazlası için buradayım. Nasıl yardımcı olabilirim?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text?: string) => {
    const userText = text ?? input.trim();
    if (!userText || loading) return;

    setInput('');
    const newMessages: AIChatMessage[] = [
      ...messages.filter((m) => m.role !== 'system'),
      { role: 'user', content: userText },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, includeContext: true }),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.error?.includes('yapılandırılmamış')) setApiKeyMissing(true);
        setMessages([
          ...newMessages,
          { role: 'assistant', content: `❌ Hata: ${data.error}` },
        ]);
      } else {
        setMessages([
          ...newMessages,
          { role: 'assistant', content: data.data.reply },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: 'assistant', content: '❌ Bağlantı hatası. Lütfen tekrar deneyin.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-screen flex flex-col max-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            🤖 AI Studio
          </h1>
          <p className="text-tv-muted text-sm mt-1">GPT-4o destekli akıllı asistan</p>
        </div>
        {!apiKeyMissing && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full glass">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">GPT-4o Aktif</span>
          </div>
        )}
      </div>

      {/* API Key Warning */}
      {apiKeyMissing && (
        <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm flex-shrink-0">
          <p className="font-semibold mb-1">⚠️ OpenAI API Anahtarı Eksik</p>
          <p className="text-xs text-amber-400">
            AI özelliklerini kullanmak için <code className="px-1 py-0.5 rounded bg-black/30">.env.local</code> dosyasına{' '}
            <code className="px-1 py-0.5 rounded bg-black/30">OPENAI_API_KEY=sk-...</code> ekleyin.
          </p>
        </div>
      )}

      {/* Quick Prompts */}
      {messages.length <= 1 && (
        <div className="grid grid-cols-3 gap-2 mb-4 flex-shrink-0">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => send(prompt.replace(/^[^a-z]+ /i, ''))}
              className="text-left px-3 py-2.5 rounded-xl border border-white/[0.08] hover:border-indigo-500/40 hover:bg-indigo-500/5 text-xs text-tv-muted hover:text-tv-text transition-all duration-200"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-tv-primary text-white rounded-br-sm'
                  : 'glass-dark text-tv-text rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' && (
                <span className="text-indigo-400 font-bold text-xs block mb-1">AI Asistan</span>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="glass-dark rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-tv-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-tv-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-tv-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 flex-shrink-0 pt-4 border-t border-white/[0.06]">
        <textarea
          ref={inputRef}
          className="input-field flex-1 resize-none h-12 py-3"
          placeholder="AI asistana bir şey sorun… (Enter ile gönder)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
        />
        <button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          className="btn-primary px-6 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {loading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
}
