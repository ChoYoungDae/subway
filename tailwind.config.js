/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 가이드라인: 모든 출구 번호는 노란색 배경(#FFD500)
        'subway-exit': '#FFD500',
        'app-bg': '#11161C',
        'app-surface': '#1A202A',
      },
      // Bilingual 가이드를 위한 유틸리티 클래스화
      fontSize: {
        'bi-main': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '700' }], // 영어용
        'bi-sub': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '400' }],  // 한국어용
      }
    },
  },
  plugins: [],
}