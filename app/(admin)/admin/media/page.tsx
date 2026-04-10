'use client';

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export default function MediaPage() {
  const [uploadType, setUploadType] = useState<'youtube' | 'instagram' | 'upload'>('youtube');
  const [ytUrl, setYtUrl] = useState('');
  const [ytTitle, setYtTitle] = useState('');
  const [igUsername, setIgUsername] = useState('');
  const [igMediaUrl, setIgMediaUrl] = useState('');
  const [igCaption, setIgCaption] = useState('');
  const [igType, setIgType] = useState('IMAGE');
  const [loading, setLoading] = useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedUrl, setUploadedUrl] = useState('');

  async function handleAddYouTube() {
    if (!ytUrl) { toast.error('URL gerekli'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: ytUrl, title: ytTitle || 'YouTube Video' }),
      });
      if (res.ok) { toast.success('YouTube eklendi'); setYtUrl(''); setYtTitle(''); }
      else toast.error('Ekleme başarısız');
    } finally { setLoading(false); }
  }

  async function handleAddInstagram() {
    if (!igUsername || !igMediaUrl) { toast.error('Kullanıcı adı ve URL gerekli'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/instagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: igUsername, mediaUrl: igMediaUrl, caption: igCaption, mediaType: igType }),
      });
      if (res.ok) { toast.success('Instagram eklendi'); setIgUsername(''); setIgMediaUrl(''); setIgCaption(''); }
      else toast.error('Ekleme başarısız');
    } finally { setLoading(false); }
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tv-text" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
          Medya Kütüphanesi
        </h1>
        <p className="text-tv-muted text-sm mt-1">YouTube ve Instagram içerik ekle</p>
      </div>

      {/* Type tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        {(['youtube', 'instagram', 'upload'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setUploadType(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              uploadType === t ? 'bg-tv-primary text-white' : 'text-tv-muted hover:text-tv-text'
            }`}
          >
            {t === 'youtube' ? '📹 YouTube' : t === 'instagram' ? '📸 Instagram' : '📁 Upload'}
          </button>
        ))}
      </div>

      {uploadType === 'youtube' && (
        <div className="admin-card space-y-4">
          <h2 className="font-semibold text-tv-text">YouTube Video Ekle</h2>
          <p className="text-tv-muted text-sm">YouTube URL veya Video ID girin</p>
          <input placeholder="https://youtube.com/watch?v=... veya VIDEO_ID" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} className="input-field w-full" />
          <input placeholder="Video başlığı" value={ytTitle} onChange={(e) => setYtTitle(e.target.value)} className="input-field w-full" />
          <button onClick={handleAddYouTube} disabled={loading} className="btn-primary">
            {loading ? 'Ekleniyor...' : 'Ekle'}
          </button>
          <p className="text-tv-muted text-xs mt-2">Eklenen videolar YouTube Yönetimi sayfasında görünür</p>
        </div>
      )}

      {uploadType === 'instagram' && (
        <div className="admin-card space-y-4">
          <h2 className="font-semibold text-tv-text">Instagram Post Ekle</h2>
          <input placeholder="Kullanıcı adı *" value={igUsername} onChange={(e) => setIgUsername(e.target.value)} className="input-field w-full" />
          <input placeholder="Görsel/Video URL *" value={igMediaUrl} onChange={(e) => setIgMediaUrl(e.target.value)} className="input-field w-full" />
          <select value={igType} onChange={(e) => setIgType(e.target.value)} className="input-field w-full">
            <option value="IMAGE">Görsel</option>
            <option value="VIDEO">Video</option>
          </select>
          <textarea placeholder="Açıklama (opsiyonel)" value={igCaption} onChange={(e) => setIgCaption(e.target.value)} className="input-field w-full h-20 resize-none" />
          <button onClick={handleAddInstagram} disabled={loading} className="btn-primary">
            {loading ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>
      )}

      {uploadType === 'upload' && (
        <div className="admin-card space-y-5">
          <div>
            <h2 className="font-semibold text-tv-text">Firebase Storage'a Yükle</h2>
            <p className="text-tv-muted text-sm mt-1">Görseller, videolar ve reklamlar için dosya yükleme</p>
          </div>

          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/10 rounded-xl p-10 cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all">
            <span className="text-4xl">{uploadFile ? '📄' : '☁️'}</span>
            <div className="text-center">
              <p className="text-tv-text text-sm font-medium">
                {uploadFile ? uploadFile.name : 'Dosya seçmek için tıklayın'}
              </p>
              <p className="text-tv-muted text-xs mt-0.5">
                {uploadFile
                  ? `${(uploadFile.size / 1024 / 1024).toFixed(2)} MB — ${uploadFile.type}`
                  : 'PNG, JPG, GIF, MP4, WebM desteklenir'}
              </p>
            </div>
            <input
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => { setUploadFile(e.target.files?.[0] ?? null); setUploadedUrl(''); setUploadProgress(0); }}
            />
          </label>

          {/* Progress bar */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-tv-muted">
                <span>Yükleniyor…</span><span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Uploaded URL */}
          {uploadedUrl && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-400">✅ Yükleme tamamlandı!</p>
              <div className="flex gap-2">
                <input readOnly value={uploadedUrl} className="input-field flex-1 text-xs" />
                <button
                  onClick={() => { navigator.clipboard.writeText(uploadedUrl); toast.success('URL kopyalandı'); }}
                  className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-tv-text text-sm transition-all"
                >
                  📋
                </button>
              </div>
              {uploadFile?.type.startsWith('image/') && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploadedUrl} alt="preview" className="w-full max-h-48 object-contain rounded-lg bg-black/30" />
              )}
            </div>
          )}

          <button
            disabled={!uploadFile || loading}
            onClick={async () => {
              if (!uploadFile || !storage) { toast.error('Firebase Storage bağlı değil'); return; }
              setLoading(true);
              const path = `media/${Date.now()}_${uploadFile.name}`;
              const storageRef = ref(storage, path);
              const task = uploadBytesResumable(storageRef, uploadFile);
              task.on('state_changed',
                (snap) => setUploadProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                () => { toast.error('Yükleme başarısız'); setLoading(false); },
                async () => {
                  const url = await getDownloadURL(task.snapshot.ref);
                  setUploadedUrl(url);
                  setUploadProgress(100);
                  setLoading(false);
                  toast.success('Dosya yüklendi!');
                }
              );
            }}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Yükleniyor…' : '☁️ Firebase\'e Yükle'}
          </button>
        </div>
      )}
    </div>
  );
}
