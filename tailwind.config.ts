import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'Space Grotesk', 'sans-serif'],
      },
      colors: {
        tv: {
          bg: '#030712',
          surface: '#0f172a',
          card: '#111827',
          border: 'rgba(255,255,255,0.08)',
          primary: '#6366f1',
          secondary: '#22d3ee',
          gold: '#f59e0b',
          success: '#10b981',
          danger: '#ef4444',
          text: '#f8fafc',
          muted: '#64748b',
        },
      },
      backgroundImage: {
        'tv-gradient': 'linear-gradient(135deg, #030712 0%, #0f172a 50%, #030712 100%)',
        'card-gradient': 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(34,211,238,0.05))',
        'ad-gradient': 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f59e0b, #d97706)',
        'primary-gradient': 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        'sidebar-gradient': 'linear-gradient(180deg, #0f172a 0%, #030712 100%)',
      },
      animation: {
        'ticker': 'ticker 40s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-right': 'slideRight 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideRight: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(99,102,241,0.3)' },
          '100%': { boxShadow: '0 0 40px rgba(99,102,241,0.6), 0 0 80px rgba(99,102,241,0.2)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'tv': '0 0 60px rgba(99, 102, 241, 0.15)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
        'glow-primary': '0 0 30px rgba(99, 102, 241, 0.4)',
        'glow-cyan': '0 0 30px rgba(34, 211, 238, 0.4)',
        'glow-gold': '0 0 30px rgba(245, 158, 11, 0.4)',
        'inner-glow': 'inset 0 1px 0 rgba(255,255,255,0.1)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
