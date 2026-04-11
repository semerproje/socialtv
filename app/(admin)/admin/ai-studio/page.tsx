'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { AIChatMessage } from '@/types';

// ─── Templates ───────────────────────────────────────────────────────────────

const AI_TEMPLATES = [
  { category: 'Reklam', icon: '🎉', label: 'Hafta Sonu Promosyonu', prompt: 'Restoran için hafta sonu özel menü promosyonu yaz. Sıcak ve davetkar ton. Başlık max 20 kelime, açıklama max 50 kelime.' },
  { category: 'Reklam', icon: '🍹', label: 'Happy Hour', prompt: 'Lounge bar için akşam 17:00–20:00 happy hour reklamı oluştur. Enerjik, akılda kalıcı başlık ve kısa açıklama yaz.' },
  { category: 'Reklam', icon: '✨', label: 'Yeni Ürün Lansmanı', prompt: 'Yeni kokteyl menüsü için etkileyici dijital ekran reklam metni yaz. Başlık + alt başlık + kısa açıklama formatında.' },
  { category: 'Reklam', icon: '🎁', label: 'Özel Teklif', prompt: '2 al 1 öde kampanyası için dikkat çekici reklam metni oluştur. Aciliyet yaratan, kısa ve öz bir mesaj yaz.' },
  { category: 'İçerik', icon: '🎵', label: 'Müzik Gecesi', prompt: 'Canlı müzik etkinliği için sosyal medya duyurusu yaz. Emoji kullan, heyecan yaratıcı ton. Max 150 karakter.' },
  { category: 'İçerik', icon: '📅', label: 'Etkinlik Duyurusu', prompt: 'Özel gecemiz için davetkar etkinlik duyurusu yaz. Tarih ve saat için yer bırak. Instagram formatında.' },
  { category: 'İçerik', icon: '🏆', label: 'Başarı Hikayesi', prompt: 'Müşteri memnuniyeti ve işletme başarısı hakkında ilham verici kısa bir sosyal medya paylaşımı yaz.' },
  { category: 'İçerik', icon: '🌅', label: 'Günlük Açılış', prompt: 'Günaydın temalı, günün başlangıcını kutlayan kısa ve pozitif bir açılış mesajı yaz. Dijital ekranda gösterilecek.' },
  { category: 'Ticker', icon: '📰', label: 'Günün Menüsü', prompt: 'Bugünün özel menüsü için haber bandı mesajı yaz. Max 80 karakter. Sıcak ve iştah açıcı.' },
  { category: 'Ticker', icon: '⚡', label: 'Acil Duyuru', prompt: 'Müşterilere kısa bir bilgilendirme mesajı yaz. Ticker bantında gösterilecek. Net ve anlaşılır, max 70 karakter.' },
  { category: 'Ticker', icon: '🕐', label: 'Kapanış Hatırlatması', prompt: 'Kapanışa 1 saat kala müşterileri bilgilendiren nazik bir ticker mesajı yaz. Max 70 karakter.' },
  { category: 'Strateji', icon: '📊', label: 'İçerik Stratejisi', prompt: 'Lounge/bar için sosyal medya ve dijital ekran içerik stratejisi öner. Bu hafta ne yayınlamalıyım? Gün bazında öneri ver.' },
  { category: 'Strateji', icon: '⏰', label: 'Prime Time Planlama', prompt: 'Bar/lounge işletmesi için haftalık yayın takvimi oluştur. Sabah, öğle, akşam ve gece saatlerine göre hangi içerik türleri gösterilmeli?' },
  { category: 'Strateji', icon: '🎯', label: 'Hedef Kitle Analizi', prompt: 'Lounge bar için hedef kitle profili oluştur. Bu kitleye en çok hangi içerikler hitap eder? 3 farklı segment ve her biri için içerik önerisi.' },
  { category: 'Strateji', icon: '🌟', label: 'Sezon Kampanyası', prompt: 'Yaz/yeni yıl/ramazan sezonuna özel 4 haftalık kampanya planı oluştur. Her hafta için farklı tema ve içerik türü öner.' },
];

// ─── Batch types ──────────────────────────────────────────────────────────────

const BATCH_TYPES = [
  { value: 'ad_headlines', label: '🎯 Reklam Başlıkları' },
  { value: 'ig_captions',  label: '📸 Instagram Caption' },
  { value: 'ticker_msgs',  label: '📰 Ticker Mesajları' },
  { value: 'event_titles', label: '🎉 Etkinlik Başlıkları' },
];

// ─── Chat Session (localStorage) ─────────────────────────────────────────────

interface ChatSession {
  id: string;
  title: string;
  messages: AIChatMessage[];
  createdAt: number;
}

const STORAGE_KEY = 'ai_studio_sessions_v1';

function loadSessions(): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]'); } catch { return []; }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 10)));
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

const GREETING: AIChatMessage = {
  role: 'assistant',
  content: '👋 Merhaba! Ben Social Lounge TV\'nin AI asistanıyım.\n\n• Sol panelden hazır şablon seçin\n• Görsel analizi için 📎 ile görsel yükleyin veya sürükle-bırak yapın\n• Toplu içerik üretimi için 📦 Toplu Üretim butonunu kullanın\n\nNasıl yardımcı olabilirim?',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AIStudioPage() {
  const [sidePanel, setSidePanel] = useState<'templates' | 'history'>('templates');
  const [messages, setMessages] = useState<AIChatMessage[]>([GREETING]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Image / Vision state
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Batch modal state
  const [showBatch, setShowBatch] = useState(false);
  const [batchType, setBatchType] = useState('ad_headlines');
  const [batchContext, setBatchContext] = useState('');
  const [batchCount, setBatchCount] = useState(5);
  const [batchResults, setBatchResults] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setSessions(loadSessions()); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const persistSession = useCallback((msgs: AIChatMessage[], sessionId: string | null): string | null => {
    const userMsg = msgs.find(m => m.role === 'user');
    if (!userMsg) return sessionId;
    const title = userMsg.content.replace(/^\[Görsel eklendi\] ?/, '').slice(0, 45) + (userMsg.content.length > 45 ? '…' : '');
    const all = loadSessions();
    let newId = sessionId;
    if (sessionId) {
      const idx = all.findIndex(s => s.id === sessionId);
      if (idx >= 0) { all[idx].messages = msgs; }
      else { all.unshift({ id: sessionId, title, messages: msgs, createdAt: Date.now() }); }
    } else {
      newId = Date.now().toString();
      all.unshift({ id: newId, title, messages: msgs, createdAt: Date.now() });
    }
    saveSessions(all);
    setSessions(loadSessions());
    return newId;
  }, []);

  const handleImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImagePreview(dataUrl);
      setImageBase64(dataUrl.split(',')[1]);
      setImageMime(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageBase64(null);
    setImagePreview(null);
    setImageMime('image/jpeg');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const send = async (text?: string) => {
    const userText = text ?? input.trim();
    if (!userText && !imageBase64) return;
    if (loading) return;

    setInput('');
    const displayText = imageBase64
      ? `[Görsel eklendi] ${userText || 'Bu görseli analiz et'}`
      : userText;

    const newMessages: AIChatMessage[] = [
      ...messages.filter(m => m.role !== 'system'),
      { role: 'user', content: displayText },
    ];
    setMessages(newMessages);
    setLoading(true);

    const hadImage = !!imageBase64;
    const imgBase64 = imageBase64;
    const imgMime = imageMime;
    clearImage();

    try {
      let reply: string;

      if (hadImage) {
        const res = await fetch('/api/ai/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: imgBase64, mimeType: imgMime, prompt: userText || 'Bu görseli analiz et. Dijital ekran içeriği veya reklam metni üretebileceğim bilgiler ver.' }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.error);
        reply = d.data.result;
      } else {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: newMessages, includeContext: true }),
        });
        const d = await res.json();
        if (!d.success) throw new Error(d.error);
        reply = d.data.reply;
      }

      const updated: AIChatMessage[] = [...newMessages, { role: 'assistant', content: reply }];
      setMessages(updated);
      const newId = persistSession(updated, currentSessionId);
      if (!currentSessionId && newId) setCurrentSessionId(newId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bilinmeyen hata';
      setMessages([...newMessages, { role: 'assistant', content: `❌ Hata: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  };

  const loadSession = (session: ChatSession) => {
    setMessages(session.messages);
    setCurrentSessionId(session.id);
    clearImage();
  };

  const newChat = () => {
    setMessages([GREETING]);
    setCurrentSessionId(null);
    clearImage();
  };

  const deleteSession = (id: string) => {
    const all = loadSessions().filter(s => s.id !== id);
    saveSessions(all);
    setSessions(all);
    if (currentSessionId === id) newChat();
  };

  const handleBatchGenerate = async () => {
    if (!batchContext.trim()) { toast.error('Konu/bağlam girin'); return; }
    setBatchLoading(true);
    setBatchResults([]);
    try {
      const res = await fetch('/api/ai/batch-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: batchType, context: batchContext, count: batchCount }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setBatchResults(d.data.results ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Üretim başarısız');
    } finally {
      setBatchLoading(false);
    }
  };

  const sendResultToChat = (text: string) => {
    setInput(text);
    setShowBatch(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const templatesByCategory = AI_TEMPLATES.reduce((acc, t) => {
    (acc[t.category] ??= []).push(t);
    return acc;
  }, {} as Record<string, typeof AI_TEMPLATES>);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#030712' }}>

      {/* ── Left Sidebar ─────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#07090f' }}>

        <div className="px-3 pt-3 pb-2 flex-shrink-0">
          <button
            onClick={newChat}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/8 text-indigo-300 hover:bg-indigo-500/18 transition-all text-xs font-semibold"
          >
            ✦ Yeni Sohbet
          </button>
        </div>

        <div className="flex gap-1 px-3 pb-2 flex-shrink-0">
          {(['templates', 'history'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSidePanel(p)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                sidePanel === p ? 'bg-white/8 text-white' : 'text-white/35 hover:text-white/55'
              )}
            >
              {p === 'templates' ? '📋 Şablonlar' : '🕘 Geçmiş'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {sidePanel === 'templates' ? (
            <div className="px-2 pb-4 space-y-3">
              {Object.entries(templatesByCategory).map(([cat, items]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-white/25 px-1.5 mb-1 mt-1">{cat}</p>
                  <div className="space-y-0.5">
                    {items.map(t => (
                      <button
                        key={t.label}
                        onClick={() => { setInput(t.prompt); inputRef.current?.focus(); }}
                        className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-left text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <span className="flex-shrink-0 text-sm">{t.icon}</span>
                        <span className="truncate">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-2 pb-4 space-y-0.5 pt-1">
              {sessions.length === 0 ? (
                <p className="text-white/20 text-xs text-center py-10">Henüz sohbet geçmişi yok</p>
              ) : sessions.map(s => (
                <div key={s.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => loadSession(s)}
                    className={cn(
                      'flex-1 text-left px-2.5 py-2 rounded-lg text-xs truncate transition-all min-w-0',
                      currentSessionId === s.id
                        ? 'bg-indigo-500/15 text-indigo-300'
                        : 'text-white/45 hover:text-white hover:bg-white/5'
                    )}
                  >
                    {s.title}
                  </button>
                  <button
                    onClick={() => deleteSession(s.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity w-6 h-6 flex items-center justify-center text-white/25 hover:text-red-400 text-xs rounded"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ── Main Chat ─────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        <header className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)', background: '#07090f' }}>
          <div>
            <h1 className="text-white font-bold text-base" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>🤖 AI Studio</h1>
            <p className="text-white/30 text-[11px]">Gemini 2.0 Flash · Çok modlu · Şablon + Toplu Üretim</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/8">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[11px] font-medium">Gemini 2.0</span>
            </div>
            <button
              onClick={() => { setBatchResults([]); setShowBatch(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/8 text-violet-300 hover:bg-violet-500/18 transition-all text-xs font-semibold"
            >
              📦 Toplu Üretim
            </button>
          </div>
        </header>

        <div
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
          style={{ scrollbarWidth: 'none' }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file?.type.startsWith('image/')) handleImageFile(file);
          }}
        >
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={cn(
                  'max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-br-sm'
                    : 'text-white/85 rounded-bl-sm border border-white/7'
                )}
                style={msg.role === 'assistant' ? { background: 'rgba(255,255,255,0.04)' } : {}}
              >
                {msg.role === 'assistant' && (
                  <span className="text-indigo-400 font-bold text-[11px] block mb-1.5">AI Asistan</span>
                )}
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm px-4 py-3 border border-white/7" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Image preview strip */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-5 pb-2 flex items-center gap-3 flex-shrink-0"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/15 flex-shrink-0">
                <img src={imagePreview} alt="" className="h-14 w-auto max-w-[120px] object-cover" />
                <button
                  onClick={clearImage}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white/70 hover:text-white flex items-center justify-center text-xs leading-none"
                >
                  ×
                </button>
              </div>
              <p className="text-white/35 text-xs">Görsel eklendi · Mesaj yazın veya boş bırakın</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar */}
        <div className="px-5 pb-4 pt-2 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div className="flex gap-2 items-end">
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Görsel Yükle"
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-white/35 hover:text-white/65 hover:border-white/20 transition-all text-base"
            >
              📎
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
            />
            <textarea
              ref={inputRef}
              className="flex-1 resize-none rounded-xl border border-white/10 bg-white/4 text-white/85 placeholder-white/25 text-sm px-3.5 py-2.5 focus:outline-none focus:border-indigo-500/40 transition-colors min-h-[40px] max-h-36"
              placeholder="Mesaj yazın ya da sol panelden şablon seçin… Görsel için 📎 veya sürükle-bırak"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
            />
            <button
              onClick={() => send()}
              disabled={loading || (!input.trim() && !imageBase64)}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-35 disabled:cursor-not-allowed transition-all text-base"
            >
              {loading ? '⏳' : '➤'}
            </button>
          </div>
          <p className="text-white/18 text-[10px] mt-1.5 text-center">Enter gönder · Shift+Enter yeni satır · PNG/JPG sürükle-bırak</p>
        </div>
      </main>

      {/* ── Batch Generate Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {showBatch && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => { if (!batchLoading) setShowBatch(false); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 p-6 shadow-2xl"
              style={{ background: '#0b0f1a' }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-white font-bold text-lg mb-1">📦 Toplu İçerik Üretimi</h3>
              <p className="text-white/40 text-sm mb-5">Tek seferinde birden fazla içerik üret</p>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">İçerik Türü</label>
                  <div className="grid grid-cols-2 gap-2">
                    {BATCH_TYPES.map(bt => (
                      <button
                        key={bt.value}
                        onClick={() => setBatchType(bt.value)}
                        className={cn(
                          'px-3 py-2.5 rounded-xl border text-xs text-left transition-all',
                          batchType === bt.value
                            ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-300'
                            : 'border-white/8 text-white/45 hover:border-white/20 hover:text-white/70'
                        )}
                      >
                        {bt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Konu / Bağlam <span className="text-indigo-400">*</span></label>
                  <textarea
                    value={batchContext}
                    onChange={(e) => setBatchContext(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-white/10 bg-white/4 text-white/80 placeholder-white/25 text-sm px-3.5 py-2.5 focus:outline-none focus:border-indigo-500/40 resize-none"
                    placeholder="Ürün/hizmet açıklaması, tema veya konu…"
                  />
                </div>

                <div>
                  <label className="text-xs text-white/50 mb-1.5 block">Adet: <span className="text-white font-semibold">{batchCount}</span></label>
                  <input
                    type="range" min={3} max={10} value={batchCount}
                    onChange={(e) => setBatchCount(Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-white/25 mt-0.5"><span>3</span><span>10</span></div>
                </div>

                <AnimatePresence>
                  {batchResults.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                      <p className="text-xs text-white/50 mb-2">{batchResults.length} sonuç — tıkla ve sohbete aktar:</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1" style={{ scrollbarWidth: 'none' }}>
                        {batchResults.map((r, i) => (
                          <button
                            key={i}
                            onClick={() => sendResultToChat(r)}
                            className="w-full text-left px-3 py-2 rounded-lg border border-white/8 text-white/65 hover:bg-white/5 hover:text-white transition-all text-xs"
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowBatch(false)} disabled={batchLoading} className="btn-secondary flex-1">Kapat</button>
                <button
                  onClick={handleBatchGenerate}
                  disabled={batchLoading || !batchContext.trim()}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {batchLoading
                    ? <><span className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" /> Üretiliyor…</>
                    : `${batchCount} İçerik Üret`
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
