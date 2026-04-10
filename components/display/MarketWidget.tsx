'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { MarketData, MarketCurrency, MarketMetal, MarketCrypto } from '@/types';

interface MarketWidgetProps {
  markets?: MarketData;
  primaryColor?: string;
  /** 'ticker' = horizontal scrolling bar | 'panel' = vertical card | 'mini' = inline badges */
  variant?: 'ticker' | 'panel' | 'mini';
}

function fmt(n: number, decimals = 2): string {
  return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n);
}

function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${fmt(n / 1_000_000, 2)}M`;
  if (n >= 1_000) return `${fmt(n / 1_000, 1)}K`;
  return fmt(n, 0);
}

// ─── Ticker variant (scrolling horizontal bar) ────────────────────────────────
function MarketTicker({ markets, primaryColor = '#6366f1' }: { markets: MarketData; primaryColor?: string }) {
  const items: string[] = [];

  for (const c of markets.currencies) {
    items.push(`${c.code}/TL  ${fmt(c.rate)} ₺`);
  }
  for (const m of markets.metals) {
    items.push(`${m.name}  ${fmt(m.priceTRY)} ₺`);
  }
  for (const c of markets.crypto) {
    items.push(`${c.code}  $${fmtCompact(c.priceUSD)}`);
  }

  if (!items.length) return null;

  const text = items.join('   ·   ');

  return (
    <div
      className="relative flex items-center overflow-hidden h-9 text-sm"
      style={{ background: 'rgba(2,8,23,0.92)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
    >
      {/* Label badge */}
      <div
        className="flex-shrink-0 flex items-center gap-1.5 px-3 h-full text-[10px] font-bold tracking-widest uppercase"
        style={{ background: `${primaryColor}20`, color: primaryColor, borderRight: `1px solid ${primaryColor}30` }}
      >
        <span>📈</span>
        <span>PİYASA</span>
      </div>
      {/* Scrolling text */}
      <div className="flex-1 overflow-hidden relative">
        <motion.div
          animate={{ x: [0, -(text.length * 8)] }}
          transition={{ duration: text.length * 0.22, ease: 'linear', repeat: Infinity }}
          className="flex whitespace-nowrap gap-12 text-white/70"
          style={{ fontFamily: "'Space Grotesk', monospace", letterSpacing: '0.02em' }}
        >
          <span>{text}</span>
          <span>{text}</span>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Panel variant (vertical card) ────────────────────────────────────────────
function MarketPanel({ markets, primaryColor = '#6366f1' }: { markets: MarketData; primaryColor?: string }) {
  type AnyMarketItem = MarketCurrency | MarketMetal | MarketCrypto;
  const [activeIdx, setActiveIdx] = useState(0);

  const allItems: { label: string; value: string; sub?: string; change?: number }[] = [
    ...markets.currencies.map((c) => ({
      label: `${c.code}/TL`,
      value: `${fmt(c.rate)} ₺`,
      change: c.change,
    })),
    ...markets.metals.map((m) => ({
      label: m.name,
      value: `${fmt(m.priceTRY)} ₺`,
      sub: `$${fmt(m.priceUSD)}`,
      change: m.change,
    })),
    ...markets.crypto.map((c) => ({
      label: c.code,
      value: `$${fmtCompact(c.priceUSD)}`,
      sub: `${fmtCompact(c.priceTRY)} ₺`,
      change: c.change,
    })),
  ];

  if (!allItems.length) return null;

  return (
    <div
      className="rounded-xl p-3 space-y-2"
      style={{ background: 'rgba(2,8,23,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div
        className="flex items-center gap-1.5 pb-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <span className="text-xs" style={{ color: primaryColor }}>📈</span>
        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: primaryColor }}>
          Piyasalar
        </span>
      </div>
      <div className="space-y-1.5">
        {allItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <span className="text-white/50 text-xs">{item.label}</span>
            <div className="flex flex-col items-end">
              <span className="text-white text-sm font-semibold tabular-nums" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {item.value}
              </span>
              {item.sub && <span className="text-white/30 text-[10px] tabular-nums">{item.sub}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Mini variant (inline badges) ────────────────────────────────────────────
function MarketMini({ markets, primaryColor = '#6366f1' }: { markets: MarketData; primaryColor?: string }) {
  const items = [
    ...markets.currencies.slice(0, 2).map((c) => `${c.code} ${fmt(c.rate)}₺`),
    ...markets.metals.slice(0, 1).map((m) => `Au ${fmt(m.priceTRY)}₺`),
    ...markets.crypto.slice(0, 1).map((c) => `₿ $${fmtCompact(c.priceUSD)}`),
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {items.map((item, i) => (
        <span
          key={i}
          className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold"
          style={{ background: `${primaryColor}15`, color: primaryColor, border: `1px solid ${primaryColor}25` }}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function MarketWidget({ markets, primaryColor, variant = 'panel' }: MarketWidgetProps) {
  if (!markets) {
    // Try fetching if not provided
    return <MarketWidgetFetcher primaryColor={primaryColor} variant={variant} />;
  }
  if (variant === 'ticker') return <MarketTicker markets={markets} primaryColor={primaryColor} />;
  if (variant === 'mini') return <MarketMini markets={markets} primaryColor={primaryColor} />;
  return <MarketPanel markets={markets} primaryColor={primaryColor} />;
}

function MarketWidgetFetcher({ primaryColor, variant }: { primaryColor?: string; variant?: 'ticker' | 'panel' | 'mini' }) {
  const [markets, setMarkets] = useState<MarketData | null>(null);

  useEffect(() => {
    fetch('/api/markets')
      .then((r) => r.json())
      .then((d) => { if (d.success) setMarkets(d.data); })
      .catch(() => {});
    const t = setInterval(() => {
      fetch('/api/markets')
        .then((r) => r.json())
        .then((d) => { if (d.success) setMarkets(d.data); })
        .catch(() => {});
    }, 5 * 60_000);
    return () => clearInterval(t);
  }, []);

  if (!markets) return null;
  if (variant === 'ticker') return <MarketTicker markets={markets} primaryColor={primaryColor} />;
  if (variant === 'mini') return <MarketMini markets={markets} primaryColor={primaryColor} />;
  return <MarketPanel markets={markets} primaryColor={primaryColor} />;
}
