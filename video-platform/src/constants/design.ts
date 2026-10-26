export const Design = {
  color: {
    background: '#0d1015',
    surface: '#151a21',
    surfaceRaised: '#1c232c',
    border: '#2b3440',
    text: '#f5f7fa',
    secondary: '#c0c7d0',
    muted: '#929dab',
    accent: '#ef4657',
    accentPressed: '#d93849',
    accentSurface: '#351f25',
    success: '#72d59a',
    danger: '#ff7b86',
  },
  light: {
    background: '#f5f6f8',
    surface: '#ffffff',
    surfaceRaised: '#eef1f5',
    border: '#dce1e8',
    text: '#181b20',
    secondary: '#4c5561',
    muted: '#697483',
    accent: '#c92f43',
    accentPressed: '#ae2437',
    accentSurface: '#fae5e8',
    success: '#19794a',
    danger: '#b42332',
  },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 28 },
  radius: { sm: 10, md: 14, lg: 20, pill: 999 },
} as const;

export type ThemeColors = typeof Design.color | typeof Design.light;
