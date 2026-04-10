'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const MainScreen = dynamic(() => import('@/components/display/MainScreen'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#030712]">
      <div className="text-center space-y-4">
        <div className="w-20 h-20 mx-auto animate-pulse">
          <Image src="/logo.png" alt="Social Lounge" width={80} height={80} className="w-full h-full object-contain" />
        </div>
        <p className="text-white/50 text-lg font-light tracking-widest">Yükleniyor…</p>
      </div>
    </div>
  ),
});

function ScreenContent() {
  const params = useSearchParams();
  const screenId = params.get('id');
  return <MainScreen screenId={screenId} />;
}

export default function ScreenPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-full flex items-center justify-center bg-[#030712]">
        <div className="w-20 h-20 animate-pulse">
          <Image src="/logo.png" alt="Social Lounge" width={80} height={80} className="w-full h-full object-contain" />
        </div>
      </div>
    }>
      <ScreenContent />
    </Suspense>
  );
}

