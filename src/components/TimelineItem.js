import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';



/**
 * Super Simple & Reliable Timeline Item
 * Layout: 
 * - Bold: label_en
 * - Medium: label_ko
 * - Expanded: originalText (on click)
 */
const TimelineItem = ({ step, isLast, originalText }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Fallback icon for safety
    const safeIcon = step.icon && step.icon !== 'gate-and-door' ? step.icon : 'circle';

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    return (
        <TouchableOpacity
            style={styles.row}
            onPress={toggleExpand}
            activeOpacity={0.7}
        >
            {/* Floor Badge */}
            <View style={styles.floorCell}>
                {step.floor ? (
                    <View style={styles.floorBadge}>
                        <Text style={styles.floorText}>{step.floor.replace('층', 'F')}</Text>
                    </View>
                ) : null}
            </View>

            {/* Icon Column */}
            <View style={styles.spine}>
                <View style={styles.iconCircle}>
                    <MaterialCommunityIcons name={safeIcon} size={16} color="#fff" />
                </View>
                {!isLast && <View style={styles.line} />}
            </View>

            {/* Content Area */}
            <View style={styles.content}>
                <Text style={styles.mainLabel} numberOfLines={1}>
                    {step.label?.replace(/[\(\)\[\]]/g, '') || 'Path'}
                    {step.label_ko ? (
                        <Text style={styles.subLabel}>   {step.label_ko.replace(/[\(\)\[\]]/g, '')}</Text>
                    ) : null}
                </Text>

                {step.bestDoor && (
                    <View style={styles.bestDoorBadge}>
                        <MaterialCommunityIcons name="door-open" size={12} color="#fff" />
                        <Text style={styles.bestDoorText}>Best Door: {step.bestDoor}</Text>
                    </View>
                )}

                {/* Expanded Original Text */}
                {isExpanded && originalText && (
                    <View style={styles.expansionArea}>
                        <Text style={styles.originalTextLabel}>Original Text:</Text>
                        <Text style={styles.originalText}>{originalText}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        width: '100%',
        minHeight: 32, // Reduced from 52
        backgroundColor: 'transparent',
    },
    floorCell: {
        width: 36,
        alignItems: 'center',
        paddingTop: 4,
    },
    floorBadge: {
        backgroundColor: '#7C4DFF',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 3,
    },
    floorText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#fff',
    },
    spine: {
        width: 24,
        alignItems: 'center',
    },
    iconCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#5d4da1',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
        marginTop: 6,
    },
    line: {
        width: 1.5,
        flex: 1,
        backgroundColor: '#D1C4E9',
        marginVertical: -2,
    },
    content: {
        flex: 1,
        paddingLeft: 10,
        paddingBottom: 8,
        paddingTop: 5,
    },
    mainLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1A237E',
    },
    subLabel: {
        fontSize: 11,
        fontWeight: '400',
        color: '#94A3B8', // Grey subLabel
    },
    expansionArea: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#F5F5F5',
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#9575CD',
    },
    originalTextLabel: {
        fontSize: 10,
        color: '#9E9E9E',
        fontWeight: 'bold',
        marginBottom: 2,
    },
    originalText: {
        fontSize: 11,
        color: '#616161',
        lineHeight: 16,
    },
    bestDoorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2e7d32',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginTop: 6,
        alignSelf: 'flex-start',
        gap: 4
    },
    bestDoorText: {
        fontSize: 10,
        fontWeight: 'bold',
        color: '#fff',
    },
});

export default TimelineItem;
