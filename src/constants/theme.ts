export const COLORS = {
  primary: '#6C3CE1',
  primaryLight: '#8B5CF6',
  primaryDark: '#5B21B6',
  secondary: '#F43F5E',
  secondaryLight: '#FB7185',
  accent: '#F59E0B',
  background: '#FAFAFE',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#1E1E2D',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
  gradientStart: '#6C3CE1',
  gradientEnd: '#F43F5E',
  christGold: '#D4AF37',
  christBlue: '#1E3A5F',
};

export const FONTS = {
  regular: { fontSize: 14 },
  medium: { fontSize: 16, fontWeight: '500' as const },
  bold: { fontSize: 16, fontWeight: '700' as const },
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '600' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  caption: { fontSize: 12 },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
};
