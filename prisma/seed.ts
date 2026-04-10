import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Social TV database...');

  // ─── Default Settings ───────────────────────────────────────────────────────
  const settings = [
    { key: 'app_name', value: 'Social Lounge TV', description: 'Application name shown on screen' },
    { key: 'app_tagline', value: 'Premium Lounge Experience', description: 'Tagline shown on screen' },
    { key: 'logo_url', value: '', description: 'Logo image URL' },
    { key: 'primary_color', value: '#6366f1', description: 'Primary accent color' },
    { key: 'secondary_color', value: '#22d3ee', description: 'Secondary accent color' },
    { key: 'weather_lat', value: '41.0082', description: 'Weather latitude' },
    { key: 'weather_lon', value: '28.9784', description: 'Weather longitude' },
    { key: 'weather_city', value: 'İstanbul', description: 'City name for weather display' },
    { key: 'content_refresh_ms', value: '10000', description: 'How often display refreshes (ms)' },
    { key: 'social_feed_scroll_speed', value: '8', description: 'Social feed scroll speed (1-10)' },
    { key: 'show_qr_code', value: 'true', description: 'Show QR code on display' },
    { key: 'qr_url', value: 'https://instagram.com/sociallounge', description: 'QR code destination URL' },
    { key: 'qr_label', value: 'Bizi takip et!', description: 'QR code label' },
    { key: 'ai_auto_moderate', value: 'true', description: 'Auto-moderate new content with AI' },
    { key: 'ai_auto_analyze', value: 'true', description: 'Auto-analyze sentiment of new content' },
    { key: 'layout', value: 'default', description: 'Display layout mode' },
    { key: 'ticker_speed', value: '40', description: 'News ticker animation duration (seconds)' },
    { key: 'ad_transition', value: 'fade', description: 'Ad transition effect' },
    { key: 'content_per_page', value: '6', description: 'Number of social posts shown' },
    { key: 'wifi_name', value: 'SocialLounge_Guest', description: 'WiFi network name to show' },
    { key: 'wifi_password', value: '12345678', description: 'WiFi password to show' },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, description: setting.description },
      create: { key: setting.key, value: setting.value, description: setting.description, updatedAt: new Date() },
    });
  }
  console.log(`✅ ${settings.length} settings seeded`);

  // ─── Demo Screen ────────────────────────────────────────────────────────────
  await prisma.screen.upsert({
    where: { id: 'main-screen' },
    update: {},
    create: {
      id: 'main-screen',
      name: 'Ana Ekran',
      location: 'Lounge Girişi',
      layoutType: 'default',
      isActive: true,
    },
  });
  console.log('✅ Default screen seeded');

  // ─── Demo Ticker Messages ────────────────────────────────────────────────────
  const tickers = [
    { text: 'Social Lounge\'ya hoş geldiniz! Harika vakit geçireceğinizi umuyoruz.', emoji: '👋', priority: 10 },
    { text: 'WiFi: SocialLounge_Guest | Şifre: 12345678', emoji: '📶', priority: 9 },
    { text: 'Haftanın her günü 10:00 - 02:00 arası açığız', emoji: '🕐', priority: 8 },
    { text: 'Instagram\'da bizi takip edin: @sociallounge', emoji: '📸', priority: 7 },
    { text: 'Mutlu Saatler: Her gün 17:00 - 20:00 | Tüm içeceklerde %30 indirim!', emoji: '🍹', priority: 8 },
    { text: 'Rezervasyon ve bilgi için: +90 (212) 000 00 00', emoji: '📞', priority: 6 },
    { text: 'Özel etkinlikler ve organizasyonlar için masanızı şimdiden ayırın', emoji: '🎉', priority: 5 },
  ];

  for (const ticker of tickers) {
    await prisma.tickerMessage.create({ data: ticker });
  }
  console.log(`✅ ${tickers.length} ticker messages seeded`);

  // ─── Demo Content ────────────────────────────────────────────────────────────
  const demoContent = [
    {
      platform: 'instagram',
      author: 'Social Lounge',
      authorHandle: '@sociallounge',
      authorAvatar: 'https://api.dicebear.com/8.x/initials/svg?seed=SL&backgroundColor=6366f1',
      text: 'Bugün lounge\'da muhteşem bir akşam! 🎵 Canlı müzik ve özel kokteyllerle sizleri bekliyoruz. #SocialLounge #CanlıMüzik',
      mediaUrl: 'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800',
      mediaType: 'image',
      likes: 1247,
      comments: 89,
      shares: 34,
      isApproved: true,
      isFeatured: true,
      sentiment: 'positive',
      sentimentScore: 0.92,
    },
    {
      platform: 'twitter',
      author: 'Ahmet Yılmaz',
      authorHandle: '@ahmetyilmaz',
      authorAvatar: 'https://api.dicebear.com/8.x/avataaars/svg?seed=ahmet',
      text: 'Social Lounge\'da harika bir gece geçirdik. Atmosfer muhteşem, müzik harika! Kesinlikle öneririm 🔥',
      likes: 342,
      comments: 12,
      shares: 8,
      isApproved: true,
      isFeatured: false,
      sentiment: 'positive',
      sentimentScore: 0.88,
    },
    {
      platform: 'instagram',
      author: 'Zeynep K.',
      authorHandle: '@zeynepk_life',
      authorAvatar: 'https://api.dicebear.com/8.x/avataaars/svg?seed=zeynep',
      text: 'Arkadaşlarla en güzel buluşma noktası ✨ @sociallounge her zaman harika #WeekendVibes #Istanbul',
      mediaUrl: 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=800',
      mediaType: 'image',
      likes: 891,
      comments: 45,
      views: 3200,
      isApproved: true,
      sentiment: 'positive',
      sentimentScore: 0.85,
    },
    {
      platform: 'announcement',
      author: 'Social Lounge',
      authorHandle: 'Yönetim',
      authorAvatar: 'https://api.dicebear.com/8.x/initials/svg?seed=SL&backgroundColor=f59e0b',
      text: '🎊 BU CUMA ÖZEL! DJ Night başlıyor — 23:00\'den itibaren gece boyu müzik. Masa rezervasyonu için hemen arayın!',
      isApproved: true,
      isFeatured: true,
      isHighlight: true,
      sentiment: 'positive',
      sentimentScore: 0.95,
    },
    {
      platform: 'tiktok',
      author: 'Istanbul Food',
      authorHandle: '@istanbulfood',
      authorAvatar: 'https://api.dicebear.com/8.x/avataaars/svg?seed=food',
      text: 'Social Lounge\'un signature cocktailleri gerçekten harika! Özellikle "Bosphorus Blue" şiddetle tavsiye ederim 🍸',
      likes: 5430,
      comments: 234,
      shares: 189,
      views: 42000,
      isApproved: true,
      sentiment: 'positive',
      sentimentScore: 0.91,
    },
  ];

  for (const content of demoContent) {
    await prisma.content.create({ data: content });
  }
  console.log(`✅ ${demoContent.length} demo content items seeded`);

  // ─── Demo Advertisements ─────────────────────────────────────────────────────
  const demoAds = [
    {
      title: 'Mutlu Saatler Promosyonu',
      description: 'Happy hour özel indirim reklamı',
      type: 'text',
      content: JSON.stringify({
        headline: 'MUTLU SAATLER',
        subheadline: 'Her gün 17:00 - 20:00',
        body: 'Tüm içeceklerde\n%30 İNDİRİM',
        cta: 'Hemen sipariş ver!',
        badge: 'BUGÜN',
      }),
      duration: 12,
      priority: 8,
      isActive: true,
      backgroundColor: '#0f172a',
      accentColor: '#f59e0b',
      textColor: '#ffffff',
    },
    {
      title: 'VIP Masa Rezervasyonu',
      description: 'VIP masa rezervasyon çağrısı',
      type: 'text',
      content: JSON.stringify({
        headline: 'VIP MASA',
        subheadline: 'REZERVASYONU',
        body: 'Özel gece için\nyerinizi ayırtın',
        cta: '+90 (212) 000 00 00',
        badge: 'SINIRLI',
      }),
      duration: 10,
      priority: 7,
      isActive: true,
      backgroundColor: '#0f172a',
      accentColor: '#6366f1',
      textColor: '#ffffff',
    },
    {
      title: 'Lounge Menüsü',
      description: 'Özel menü tanıtımı',
      type: 'image',
      content: 'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=1920&h=1080',
      duration: 15,
      priority: 5,
      isActive: true,
    },
    {
      title: 'DJ Night Etkinliği',
      description: 'Haftalık DJ etkinlik duyurusu',
      type: 'text',
      content: JSON.stringify({
        headline: 'DJ NIGHT',
        subheadline: 'Her Cuma & Cumartesi',
        body: '23:00\'dan itibaren\nGece boyu müzik',
        cta: 'Bugün gel, partiye katıl!',
        badge: 'HER HAFTA',
      }),
      duration: 12,
      priority: 9,
      isActive: true,
      backgroundColor: '#0f172a',
      accentColor: '#22d3ee',
      textColor: '#ffffff',
    },
  ];

  for (const ad of demoAds) {
    await prisma.advertisement.create({ data: ad });
  }
  console.log(`✅ ${demoAds.length} demo advertisements seeded`);

  console.log('\n🎉 Database seeded successfully!');
  console.log('🚀 Run `npm run dev` to start the application');
  console.log('📺 Display: http://localhost:3000/screen');
  console.log('⚙️  Admin:   http://localhost:3000/admin');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
