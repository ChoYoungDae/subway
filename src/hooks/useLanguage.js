import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANGUAGE_KEY = '@app_language';
export const DEFAULT_LANG = 'en';

/**
 * Returns the currently selected language code ('en', 'ko', etc.).
 * Reads from AsyncStorage on mount; falls back to DEFAULT_LANG.
 */
export function useLanguage() {
    const [lang, setLang] = useState(DEFAULT_LANG);

    useEffect(() => {
        AsyncStorage.getItem(LANGUAGE_KEY)
            .then(saved => { if (saved) setLang(saved); })
            .catch(() => {});
    }, []);

    return lang;
}

/**
 * Persists the selected language to AsyncStorage.
 */
export async function saveLanguage(code) {
    await AsyncStorage.setItem(LANGUAGE_KEY, code);
}

/**
 * Resolves a STRINGS entry ({ en: '...', ko: '...' }) to the given language,
 * falling back to 'en' if the language is not available.
 */
export function t(entry, lang) {
    if (!entry) return '';
    return entry[lang] ?? entry[DEFAULT_LANG] ?? '';
}
