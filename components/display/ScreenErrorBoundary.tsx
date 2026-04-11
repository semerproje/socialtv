'use client';

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class ScreenErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ScreenErrorBoundary]', error, info.componentStack);
    // Auto-reload after 30 seconds
    this.retryTimer = setTimeout(() => {
      window.location.reload();
    }, 30_000);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setState({ hasError: false, error: null, retryCount: this.state.retryCount + 1 });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#030712] select-none">
          <div className="text-center space-y-6 px-8 max-w-lg">
            {/* Logo */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 flex items-center justify-center text-3xl">
              📺
            </div>

            <div className="space-y-2">
              <p className="text-white/70 text-xl font-medium tracking-wide">
                Bağlantı Hatası
              </p>
              <p className="text-white/30 text-sm tracking-widest uppercase">
                Yeniden bağlanıyor…
              </p>
            </div>

            {/* Animated progress bar */}
            <div className="h-1 w-48 mx-auto rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full"
                style={{ animation: 'progress-30s 30s linear forwards' }}
              />
            </div>

            <p className="text-white/20 text-xs">
              30 saniye içinde otomatik yeniden başlatılacak
            </p>

            <button
              onClick={this.handleRetry}
              className="px-6 py-2.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium transition-all"
            >
              Hemen Yeniden Başlat
            </button>
          </div>

          <style>{`
            @keyframes progress-30s {
              from { width: 0% }
              to { width: 100% }
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
