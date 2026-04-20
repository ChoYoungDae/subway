import React from 'react';
import { View, Text } from 'react-native';

interface ExitBadgeProps {
    num: string | number;
    size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

export const ExitBadge: React.FC<ExitBadgeProps> = ({ num, size = 'md', className }) => {
    if (!num || num === 'NONE' || num === 'none') return null;
    let paddingClass = 'px-1.5 py-0.5';
    let fontSizeClass = 'text-[10px]';
    if (size === 'lg') {
        paddingClass = 'px-2 py-0.5';
        fontSizeClass = 'text-[12px]';
    }
    if (size === 'sm') {
        paddingClass = 'px-1 py-0.5';
        fontSizeClass = 'text-[9px]';
    }
    if (size === 'xs') {
        paddingClass = 'px-1 py-0';
        fontSizeClass = 'text-[8px]';
    }
    if (size === 'xxs') {
        paddingClass = 'px-0.5 py-0';
        fontSizeClass = 'text-[7px]';
    }

    return (
        <View className={`bg-subway-exit rounded justify-center items-center ${paddingClass} ${className || ''}`}>
            <Text className={`text-black font-bold ${fontSizeClass}`}>EXIT {num}</Text>
        </View>
    );
};
