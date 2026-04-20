import React from 'react';
import { View, Text, ViewProps, TextProps } from 'react-native';

interface BiLabelProps {
    en?: string;
    ko?: string;
    style?: any;
    className?: string;
    enClassName?: string;
    koClassName?: string;
}

export const BiLabel: React.FC<BiLabelProps> = ({ en, ko, style, className, enClassName, koClassName }) => {
    return (
        <View style={style} className={`flex-col justify-center items-start ${className || ''}`}>
            {!!en && <Text style={{ fontFamily: 'Nunito-Bold' }} className={`text-bi-main text-[#111116] ${enClassName || ''}`}>{en}</Text>}
            {!!ko && <Text style={{ fontFamily: 'Pretendard-Regular' }} className={`text-bi-sub text-gray-500 mt-0.5 ${koClassName || ''}`}>{ko}</Text>}
        </View>
    );
};
