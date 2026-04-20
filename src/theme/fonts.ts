/**
 * Font constants — Step-Free Seoul Subway v1.1.0
 *
 * English & Numbers : Nunito  (@expo-google-fonts/nunito)
 * Korean            : Pretendard  (local TTF → assets/fonts/)
 *   Place the following files in assets/fonts/ to enable Pretendard:
 *     Pretendard-Regular.ttf
 *     Pretendard-Medium.ttf
 *     Pretendard-Bold.ttf
 */

// Nunito — loaded via useFonts in App.js
export const FONT_EN_REGULAR   = 'Nunito-Regular';    // Nunito_400Regular
export const FONT_EN_MEDIUM    = 'Nunito-Medium';     // Nunito_500Medium
export const FONT_EN_SEMIBOLD  = 'Nunito-SemiBold';   // Nunito_600SemiBold
export const FONT_EN_BOLD      = 'Nunito-Bold';       // Nunito_700Bold
export const FONT_EN_EXTRABOLD = 'Nunito-ExtraBold';  // Nunito_800ExtraBold

// Pretendard — loaded via useFonts in App.js (local file)
export const FONT_KO_REGULAR   = 'Pretendard-Regular';
export const FONT_KO_MEDIUM    = 'Pretendard-Medium';
export const FONT_KO_BOLD      = 'Pretendard-Bold';

// Convenience aliases
export const FONT_NUMBER       = FONT_EN_REGULAR;   // Numeric data always Nunito
