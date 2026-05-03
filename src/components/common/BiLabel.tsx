import React from 'react';
import { View, Text } from 'react-native';
import { useAppLang } from '../../context/LanguageContext';

interface BiLabelProps {
    en?: string;
    ko?: string;
    /** When true, always shows both languages (e.g. station names). Default: false (selected lang only). */
    bilingual?: boolean;
    style?: any;
    className?: string;
    enClassName?: string;
    koClassName?: string;
}

export const BiLabel: React.FC<BiLabelProps> = ({ en, ko, bilingual = false, style, className, enClassName, koClassName }) => {
    const { lang } = useAppLang();

    const showEn = bilingual || lang === 'en' || !ko;
    const showKo = bilingual ? true : (lang === 'ko' && !!ko);

    return (
        <View style={style} className={`flex-col justify-center items-start ${className || ''}`}>
            {showEn && !!en && (
                <Text style={{ fontFamily: 'Nunito-Bold' }} className={`text-bi-main text-[#111116] ${enClassName || ''}`}>{en}</Text>
            )}
            {showKo && !!ko && (
                <Text style={{ fontFamily: 'Pretendard-Regular' }} className={`text-bi-sub text-gray-500 mt-0.5 ${koClassName || ''}`}>{ko}</Text>
            )}
        </View>
    );
};
