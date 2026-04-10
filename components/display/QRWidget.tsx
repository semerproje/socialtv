'use client';

import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';

interface QRWidgetProps {
  url: string;
  label?: string;
  wifiName?: string;
  wifiPassword?: string;
}

export default function QRWidget({ url, label, wifiName, wifiPassword }: QRWidgetProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-dark rounded-2xl p-4"
    >
      <div className="flex items-center gap-4">
        {/* QR Code */}
        <div className="flex-shrink-0">
          <div className="bg-white p-2 rounded-xl">
            <QRCodeSVG
              value={url}
              size={72}
              bgColor="#ffffff"
              fgColor="#030712"
              level="M"
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-tv-muted uppercase tracking-widest mb-1">Bağlan</p>
          <p className="text-sm font-semibold text-tv-text truncate">{label ?? 'Bizi takip et!'}</p>
          {wifiName && (
            <div className="mt-2 pt-2 border-t border-white/[0.06]">
              <p className="text-xs text-tv-muted">📶 {wifiName}</p>
              {wifiPassword && (
                <p className="text-xs text-emerald-400 font-mono mt-0.5">🔑 {wifiPassword}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
