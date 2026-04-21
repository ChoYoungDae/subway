import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { getLineColor, getLineBadgeLabel } from '../../utils/lineColors';

interface LineBadgeProps {
    line: string | number;
    color?: string;
    size?: number;
    className?: string;
}

const LineBadge: React.FC<LineBadgeProps> = ({ line, color, size = 28, className }) => {
    const bgColor = color || getLineColor(line);
    const label = getLineBadgeLabel(line);

    return (
        <View
            className={className}
            style={[
                styles.badge,
                {
                    backgroundColor: bgColor,
                    width: size,
                    height: size,
                    borderRadius: size / 2
                }
            ]}
        >
            <Text style={[styles.text, { fontSize: size * 0.45 }]}>{label}</Text>
        </View>
    );
};

export default LineBadge;

const styles = StyleSheet.create({
    badge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        color: '#FFFFFF',
        fontFamily: 'Nunito-ExtraBold',
    },
});
