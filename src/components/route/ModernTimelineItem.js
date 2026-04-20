import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ModernTimelineItem({
    node,
    isLast,
    lineColor = '#8E8E93',
    lineType = 'solid' // 'solid' or 'dotted'
}) {
    // Map icon names to local specific styling or icons
    const getIconInfo = (type, iconName) => {
        switch (iconName) {
            case 'login': return { name: 'login', size: 16 };
            case 'elevator': return { name: 'elevator-passenger-outline', size: 18 };
            case 'gate': return { name: 'ray-start-arrow', size: 16 };
            case 'walk': return { name: 'human-walking', size: 18 };
            case 'train': return { name: 'train-variant', size: 18 };
            case 'logout': return { name: 'logout', size: 16 };
            default: return { name: iconName || 'circle-small', size: 18 };
        }
    };

    const iconInfo = getIconInfo(node.type, node.icon);

    return (
        <View style={styles.container}>
            {/* Timeline Column */}
            <View style={styles.timelineCol}>
                <View style={[
                    styles.nodeCircle,
                    { backgroundColor: node.type === 'boarding' ? lineColor : '#1E242F', borderColor: lineColor }
                ]}>
                    {node.type === 'boarding' ? (
                        <Text style={styles.lineNumText}>{node.lineNum}</Text>
                    ) : (
                        <MaterialCommunityIcons name={iconInfo.name} size={iconInfo.size} color={node.type === 'boarding' ? '#FFF' : '#8E8E93'} />
                    )}
                </View>
                {!isLast && (
                    <View style={[
                        styles.connector,
                        {
                            backgroundColor: lineType === 'solid' ? lineColor : 'transparent',
                            borderStyle: lineType,
                            borderLeftWidth: lineType === 'dotted' ? 2 : 0,
                            borderColor: lineColor
                        }
                    ]} />
                )}
            </View>

            {/* Content Column */}
            <View style={styles.contentCol}>
                <View style={styles.mainRow}>
                    <Text style={styles.titleEn}>{node.titleEn}</Text>
                    <Text style={styles.titleKo}>{node.titleKo}</Text>
                </View>
                <Text style={styles.subtitle}>{node.subtitle}</Text>

                {/* Optional Boarding Card */}
                {node.boardingPosition && (
                    <View style={styles.boardingCard}>
                        <View style={styles.boardingIconWrapper}>
                            <MaterialCommunityIcons name="information-outline" size={16} color="#3D5AFE" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.boardingMainText}>
                                Wait at Car {node.boardingPosition.car} <Text style={styles.boardingSubText}>({node.boardingPosition.carKo})</Text>
                            </Text>
                            <Text style={styles.boardingHint}>{node.boardingPosition.hint}</Text>
                        </View>
                    </View>
                )}

                {/* Stops / Time info */}
                {node.travelInfo && (
                    <View style={styles.travelInfoRow}>
                        <MaterialCommunityIcons name="dots-vertical" size={14} color="#8E8E93" />
                        <Text style={styles.travelInfoText}>{node.travelInfo}</Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
    },
    timelineCol: {
        width: 48,
        alignItems: 'center',
    },
    nodeCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        backgroundColor: '#1E242F',
        zIndex: 2,
    },
    lineNumText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
    },
    connector: {
        width: 2,
        flex: 1,
        marginVertical: -2,
    },
    contentCol: {
        flex: 1,
        paddingBottom: 28,
        paddingTop: 4,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    titleEn: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '800',
    },
    titleKo: {
        color: '#8E8E93',
        fontSize: 15,
        fontWeight: '500',
    },
    subtitle: {
        color: '#8E8E93',
        fontSize: 13,
        marginTop: 2,
    },
    boardingCard: {
        backgroundColor: '#1E242F',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2A303C',
    },
    boardingIconWrapper: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#121821',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    boardingMainText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },
    boardingSubText: {
        color: '#8E8E93',
        fontSize: 13,
    },
    boardingHint: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 2,
    },
    travelInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        gap: 4,
    },
    travelInfoText: {
        color: '#8E8E93',
        fontSize: 13,
    },
});
