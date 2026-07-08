import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: '#070913',
        bgSurface: 'rgba(13, 17, 33, 0.45)',
        accentPurple: '#c084fc',
        accentTeal: '#2dd4bf',
        accentIndigo: '#818cf8',
        textPrimary: '#f8fafc',
        textSecondary: '#94a3b8',
        textMuted: '#64748b',
      },
      backgroundImage: {
        'gradient-hero': 'linear-gradient(135deg, #c084fc 0%, #818cf8 50%, #2dd4bf 100%)',
      }
    },
  },
  plugins: [],
};
export default config;
