// Mirrors the color values in styles/globals.css for the one context that
// can't read CSS custom properties: email HTML in lib/resend.ts. Everything
// else reads styles/globals.css directly (Tailwind v4 is CSS-native).
// Keep these in sync if you change a color in styles/globals.css.

export const colors = {
  emerald: '#00503d',
  emeraldLight: '#e8f5f0',
  emeraldHover: '#003d2f',
  emeraldDark: '#003828',
  cream: '#fde7d4',
  creamLight: '#fff8f0',
  lightBrown: '#9f785d',
  blue: '#213f65',
  blueLight: '#2a4f7a',
  darkBrown: '#4d301b',
  white: '#ffffff',
  gray: {
    50: '#faf9f7',
    100: '#f5f3f0',
    200: '#e8e4df',
    300: '#d4cec7',
    400: '#a8a095',
    500: '#7a7268',
    600: '#5c554d',
  },
} as const
