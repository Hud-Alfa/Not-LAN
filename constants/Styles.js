import { StyleSheet, Platform } from 'react-native';
import { Colors } from './Colors';

export const Styles = StyleSheet.create({
  // Container stilleri
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 20 : 0,
  },
  
  // Kart stilleri
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  
  // Buton stilleri
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: Colors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondary: {
    backgroundColor: Colors.primaryLighter,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondaryText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutlineText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Input stilleri
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginVertical: 8,
  },
  inputFocused: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  
  // Metin stilleri
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  
  // Spacing
  spacingSmall: { marginVertical: 4 },
  spacingMedium: { marginVertical: 8 },
  spacingLarge: { marginVertical: 16 },
  
  // Flex
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  
  // Diğer
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  shadow: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
});

