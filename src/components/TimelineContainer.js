import React, { useMemo } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import TimelineItem from './TimelineItem';

/**
 * Enhanced Timeline Container - Reliable data display
 */
const TimelineContainer = ({ routeData, originalText, style }) => {
    const steps = useMemo(() => {
        let result = [];
        if (!routeData) result = [];
        else if (Array.isArray(routeData)) result = routeData;
        else if (typeof routeData === 'string') {
            try {
                result = JSON.parse(routeData);
            } catch (e) {
                result = [];
            }
        }
        console.log(`[TimelineContainer] Steps Count: ${result.length}`);
        return result;
    }, [routeData]);

    // Fallback: If no structured steps found but we have original text
    if (steps.length === 0) {
        if (!originalText) return null;
        return (
            <View style={[styles.fallbackContainer, style]}>
                <Text style={styles.fallbackLabel}>Raw Route Description:</Text>
                <Text style={styles.fallbackText}>{originalText}</Text>
            </View>
        );
    }

    return (
        <View style={[styles.container, style]}>
            {steps.map((step, index) => (
                <TimelineItem
                    key={`step-${index}`}
                    step={step}
                    isLast={index === steps.length - 1}
                    // Show step-specific original text OR global original text for first/only step
                    originalText={step.originalText || (steps.length === 1 ? originalText : null)}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        paddingVertical: 8,
    },
    fallbackContainer: {
        padding: 16,
        backgroundColor: '#F8F9FA',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E9ECEF',
        marginVertical: 10,
    },
    fallbackLabel: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#adb5bd',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    fallbackText: {
        fontSize: 13,
        color: '#495057',
        lineHeight: 18,
    },
});

export default TimelineContainer;
