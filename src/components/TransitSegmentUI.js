import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const TransitSegmentUI = ({ segments, isDetailed = true }) => {
    if (!segments) return null;

    // Convert object to sorted array for flexible rendering (2-1, 2-2, 2-3...)
    const segmentList = Object.keys(segments)
        .filter(key => key.startsWith('step'))
        .sort((a, b) => a.localeCompare(b))
        .map(key => segments[key]);

    const renderSegment = (segment, stepLabel, isLast = false) => (
        <View style={[styles.segmentContainer, isLast && { borderBottomWidth: 0 }]} key={segment.id}>
            <View style={styles.segmentLeft}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Step {stepLabel || segment.id}</Text>
                </View>
                {!isLast && <View style={styles.connector} />}
            </View>
            <View style={styles.segmentRight}>
                <Text style={styles.labelEn}>{segment.en}</Text>
                <Text style={styles.labelKo}>{segment.ko}</Text>

                {/* Specific 2단계 Data Display: Best Door */}
                {segment.bestDoorEn && (
                    <View style={styles.dataHighlight}>
                        <Text style={styles.dataHighlightEmoji}>🚪</Text>
                        <View>
                            <Text style={styles.dataLabelEn}>{segment.bestDoorEn}</Text>
                            <Text style={styles.dataLabelKo}>{segment.bestDoorKo}</Text>
                        </View>
                    </View>
                )}

                {/* Exit Side */}
                {segment.exitSideEn && (
                    <View style={styles.subInfoRow}>
                        <Text style={styles.subInfoEn}>• {segment.exitSideEn}</Text>
                        <Text style={styles.subInfoKo}> ({segment.exitSideKo})</Text>
                    </View>
                )}

                {/* Station List Preview */}
                {segment.stations && segment.stations.length > 0 && (
                    <View style={styles.stationBrief}>
                        <Text style={styles.stationBriefText}>
                            {segment.stations.length} stops ({segment.stations[0]} → {segment.stations[segment.stations.length - 1]})
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>3-Segment Journey (Transit)</Text>
            </View>

            {isDetailed ? (
                segmentList.map((segment, index) =>
                    renderSegment(segment, segment.id, index === segmentList.length - 1)
                )
            ) : (
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryTextEn}>{segmentList[0].en}</Text>
                    <Text style={styles.summaryTextKo}>{segmentList[0].ko}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 0,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: '#EFEFEF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 12,
        elevation: 3,
        overflow: 'hidden',
    },
    header: {
        backgroundColor: '#F7FCF7', // Light green for transit
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E8F5E9',
    },
    headerTitle: {
        fontSize: 11,
        fontFamily: 'Nunito-Bold',
        color: '#2E7D32',
        letterSpacing: 0.5,
        textTransform: 'uppercase',
    },
    segmentContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    segmentLeft: {
        width: 64,
        alignItems: 'center',
    },
    badge: {
        backgroundColor: '#2E7D32', // Green for transit
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontFamily: 'Nunito-ExtraBold',
    },
    connector: {
        width: 1.5,
        flex: 1,
        backgroundColor: '#E8F5E9',
        marginVertical: 4,
    },
    segmentRight: {
        flex: 1,
        paddingLeft: 4,
    },
    labelEn: {
        fontSize: 15,
        fontFamily: 'Nunito-Bold',
        color: '#1A1A1A',
        lineHeight: 20,
    },
    labelKo: {
        fontSize: 12,
        fontFamily: 'Pretendard-Regular',
        fontWeight: '500',
        color: '#757575',
        marginTop: 3,
    },
    dataHighlight: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F8E9',
        padding: 8,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#DCEDC8',
    },
    dataHighlightEmoji: {
        fontSize: 18,
        marginRight: 10,
    },
    dataLabelEn: {
        fontSize: 12,
        fontFamily: 'Nunito-Bold',
        color: '#33691E',
    },
    dataLabelKo: {
        fontSize: 10,
        color: '#558B2F',
        marginTop: 1,
    },
    subInfoRow: {
        flexDirection: 'row',
        marginTop: 6,
        alignItems: 'center',
    },
    subInfoEn: {
        fontSize: 11,
        fontWeight: '600',
        color: '#666',
    },
    subInfoKo: {
        fontSize: 11,
        color: '#999',
    },
    stationBrief: {
        marginTop: 8,
        padding: 6,
        backgroundColor: '#F9F9F9',
        borderRadius: 4,
    },
    stationBriefText: {
        fontSize: 10,
        color: '#999',
        fontStyle: 'italic',
    },
    summaryBox: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryTextEn: {
        fontSize: 13,
        fontWeight: '700',
        color: '#333',
        textAlign: 'center',
    },
    summaryTextKo: {
        fontSize: 11,
        color: '#888',
        marginTop: 3,
        textAlign: 'center',
    },
});

export default TransitSegmentUI;
