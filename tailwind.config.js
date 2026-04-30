/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['Noto Sans Thai', 'Space Grotesk', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      colors: {
        game: {
          base:     '#07090f',
          surface:  '#0d1117',
          elevated: '#131922',
          border:   'rgba(255,255,255,0.09)',
        },
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      animation: {
        'float':        'float 5s ease-in-out infinite',
        'shimmer':      'shimmerMove 3s linear infinite',
        'spectrum':     'spectrum 6s ease infinite',
        'timer-pulse':  'timerPulse 0.7s ease-in-out infinite',
        'status-pulse': 'statusPulse 2s ease infinite',
        'fade-up':      'fadeUp 0.4s cubic-bezier(0.16,1,0.3,1) forwards',
        'scale-in':     'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards',
      },
      keyframes: {
        float:        { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-7px)' } },
        shimmerMove:  { '0%': { backgroundPosition: '200% center' }, '100%': { backgroundPosition: '-200% center' } },
        spectrum:     { '0%,100%': { backgroundPosition: '0% 50%' }, '50%': { backgroundPosition: '100% 50%' } },
        timerPulse:   { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.55' } },
        statusPulse:  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        fadeUp:       { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        scaleIn:      { from: { opacity: '0', transform: 'scale(0.92)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      backdropBlur: { xs: '4px' },
      boxShadow: {
        'glow-blue':   '0 0 24px rgba(59,130,246,0.35), 0 0 48px rgba(59,130,246,0.12)',
        'glow-gold':   '0 0 24px rgba(245,158,11,0.35), 0 0 48px rgba(245,158,11,0.12)',
        'glow-green':  '0 0 24px rgba(16,185,129,0.35), 0 0 48px rgba(16,185,129,0.12)',
        'glow-red':    '0 0 24px rgba(239,68,68,0.35),  0 0 48px rgba(239,68,68,0.12)',
        'glow-purple': '0 0 24px rgba(167,139,250,0.35),0 0 48px rgba(167,139,250,0.12)',
      },
    },
  },
  plugins: [],
}
