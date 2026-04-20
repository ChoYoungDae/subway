import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const DestinationSegmentUI = ({ segments, isDetailed = true }) => {
    if (!segments) return null;

    // Convert object to sorted array (3-1, 3-2, 3-3)
    const segmentList = Object.keys(segments)
        .filter(key => key.startsWith('step'))
        .sort((a, b) => a.localeCompare(b))
        .map(key => segments[key]);

    const finalGoal = segments.final;

    const renderSegment = (segment, stepLabel, isLast = false) => (
        <View style={[styles.segmentContainer, isLast && { borderBottomWidth: 0, paddingBottom: 8 }]} key={segment.id}>
            <View style={styles.segmentLeft}>
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>Step {stepLabel || segment.id}</Text>
                </View>
                {!isLast && <View style={styles.connector} />}
            </View>
            <View style={styles.segmentRight}>
                <Text style={styles.labelEn}>{segment.en}</Text>
                <Text style={styles.labelKo}>{segment.ko}</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>3-Segment Journey (Destination)</Text>
            </View>

            {isDetailed ? (
                segmentList.map((segment, index) =>
                    renderSegment(segment, segment.id, index === segmentList.length - 1)
                )
            ) : (
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryTextEn}>Detailed guide will appear when near arrival.</Text>
                    <Text style={styles.summaryTextKo}>도착역 근처 도달 시 상세 가이드가 표시됩니다.</Text>
                </View>
            )}

            {/* Final Arrival Message */}
            {finalGoal && (
                <View style={styles.arrivalBox}>
                    <View style={styles.arrivalEmojiBg}>
                        <Text style={styles.arrivalEmoji}>🚩</Text>
                    </View>
                    <View style={styles.arrivalTextCenter}>
                        <Text style={styles.arrivalEn}>{finalGoal.en}</Text>
                        <Text style={styles.arrivalKo}>{finalGoal.ko}</Text>
                    </View>
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
        backgroundColor: '#F0F4FF', // Soft indigo for arrival
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E0E8FF',
    },
    headerTitle: {
        fontSize: 11,
        fontFamily: 'Nunito-Bold',
        color: '#3F51B5',
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
        backgroundColor: '#3F51B5',
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
        backgroundColor: '#E0E8FF',
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
    arrivalBox: {
        backgroundColor: '#3F51B5',
        margin: 12,
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    arrivalEmojiBg: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    arrivalEmoji: {
        fontSize: 16,
    },
    arrivalTextCenter: {
        alignItems: 'flex-start',
    },
    arrivalEn: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
    },
    arrivalKo: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1,
    },
    summaryBox: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    summaryTextEn: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        textAlign: 'center',
    },
    summaryTextKo: {
        fontSize: 10,
        color: '#999',
        marginTop: 4,
        textAlign: 'center',
    },
});

export default DestinationSegmentUI;
