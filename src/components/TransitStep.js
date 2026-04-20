import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * TransitStep: Displays actual transportation info (Subway Line, Direction, etc.)
 * Standard: English primary, Korean secondary
 */
const TransitStep = ({
    lineNumber,
    direction,
    directionKo,
    travelTime,
    stationCount,
    lineColor = '#7c65c1',
    isRealTime = false, // TODO: Integrate real-time API when available
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.spine}>
                <View style={[styles.line, { backgroundColor: lineColor }]} />
                <View style={[styles.iconCircle, { backgroundColor: lineColor }]}>
                    <MaterialCommunityIcons name="subway-variant" size={18} color="#fff" />
                </View>
                <View style={[styles.line, { backgroundColor: lineColor }]} />
            </View>

            <View style={styles.content}>
                <View style={styles.headerRow}>
                    <View style={styles.lineInfoRow}>
                        <Text style={styles.lineText}>
                            Line {lineNumber} <Text style={styles.subText}>({lineNumber}호선)</Text>
                        </Text>
                        {isRealTime && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>Live (실시간)</Text>
                            </View>
                        )}
                    </View>
                    {direction && (
                        <Text style={styles.directionText}>
                            Towards {direction} <Text style={styles.subText}>({directionKo || direction} 방면)</Text>
                        </Text>
                    )}
                </View>

                <View style={styles.detailsRow}>
                    {travelTime && (
                        <View style={styles.detailBadge}>
                            <MaterialCommunityIcons name="clock-outline" size={12} color="#64748B" />
                            <Text style={styles.detailText}>
                                {travelTime} mins <Text style={styles.subText}>({travelTime}분 소요)</Text>
                            </Text>
                        </View>
                    )}
                    {stationCount && (
                        <View style={styles.detailBadge}>
                            <MaterialCommunityIcons name="train" size={12} color="#64748B" />
                            <Text style={styles.detailText}>
                                {stationCount} Stations <Text style={styles.subText}>({stationCount}개 역 이동)</Text>
                            </Text>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        minHeight: 80,
    },
    spine: {
        width: 32,
        alignItems: 'center',
        marginRight: 20,
    },
    line: {
        width: 3,
        flex: 1,
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 4,
        zIndex: 2,
    },
    content: {
        flex: 1,
        paddingBottom: 20,
        justifyContent: 'center',
    },
    headerRow: {
        marginBottom: 8,
    },
    lineInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    lineText: {
        fontSize: 16,
        fontWeight: '900',
        color: '#1a1040',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fee2e2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 4,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    liveText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#ef4444',
        textTransform: 'uppercase',
    },
    directionText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginTop: 2,
    },
    subText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#94A3B8',
    },
    detailsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    detailBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        gap: 4,
    },
    detailText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
});

export default TransitStep;
