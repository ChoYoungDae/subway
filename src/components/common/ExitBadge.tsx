import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ExitBadgeProps {
    num: string | number;
    size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

const sizeMap: Record<string, { paddingHorizontal: number; paddingVertical: number; fontSize: number }> = {
    xxs: { paddingHorizontal: 2,  paddingVertical: 0, fontSize: 7  },
    xs:  { paddingHorizontal: 4,  paddingVertical: 0, fontSize: 8  },
    sm:  { paddingHorizontal: 4,  paddingVertical: 2, fontSize: 9  },
    md:  { paddingHorizontal: 6,  paddingVertical: 2, fontSize: 10 },
    lg:  { paddingHorizontal: 8,  paddingVertical: 2, fontSize: 12 },
};

export const ExitBadge: React.FC<ExitBadgeProps> = ({ num, size = 'md' }) => {
    if (!num || num === 'NONE' || num === 'none') return null;
    const { paddingHorizontal, paddingVertical, fontSize } = sizeMap[size] ?? sizeMap.md;

    return (
        <View style={[styles.badge, { paddingHorizontal, paddingVertical }]}>
            <Text style={[styles.text, { fontSize }]}>EXIT {num}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    badge: {
        backgroundColor: '#FFD500',
        borderRadius: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#000000',
        fontFamily: 'Nunito-Bold',
    },
});
