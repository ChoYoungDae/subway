import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LANGUAGE_KEY = '@app_language';
export const DEFAULT_LANG = 'en';

const LanguageContext = createContext({ lang: DEFAULT_LANG, setLang: () => {} });

export function LanguageProvider({ children }) {
    const [lang, setLangState] = useState(DEFAULT_LANG);

    useEffect(() => {
        AsyncStorage.getItem(LANGUAGE_KEY)
            .then(saved => { if (saved) setLangState(saved); })
            .catch(() => {});
    }, []);

    const setLang = async (code) => {
        setLangState(code);
        try { await AsyncStorage.setItem(LANGUAGE_KEY, code); } catch {}
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useAppLang() {
    return useContext(LanguageContext);
}

/** Resolve a { en, ko } string entry to the active language, with English fallback. */
export function tLang(entry, lang) {
    if (!entry) return '';
    return entry[lang] ?? entry[DEFAULT_LANG] ?? '';
}

/** Pick from (en, ko) string pair by active language. */
export function pick(en, ko, lang) {
    return lang === 'ko' ? (ko || en) : (en || ko);
}
