import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const OriginSegmentUI = ({ segments, isDetailed = true }) => {
    if (!segments) return null;

    const { step1_1, step1_2, step1_3, isDirect, merged } = segments;

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
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>3-Segment Journey (Origin)</Text>
            </View>

            {isDetailed ? (
                <>
                    {renderSegment(step1_1, '1-1', false)}

                    {isDirect ? (
                        renderSegment(merged, '1-2 & 1-3', true)
                    ) : (
                        <>
                            {renderSegment(step1_2, '1-2', false)}
                            {renderSegment(step1_3, '1-3', true)}
                        </>
                    )}
                </>
            ) : (
                <View style={styles.summaryBox}>
                    <Text style={styles.summaryTextEn}>{step1_1.en}</Text>
                    <Text style={styles.summaryTextKo}>{step1_1.ko}</Text>
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
        backgroundColor: '#F9F8FF',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F0EEFF',
    },
    headerTitle: {
        fontSize: 11,
        fontFamily: 'Nunito-Bold',
        color: '#7C65C1',
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
        backgroundColor: '#7C65C1',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: '800',
    },
    connector: {
        width: 1.5,
        flex: 1,
        backgroundColor: '#EEEBFF',
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
    summaryBox: {
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryTextEn: {
        fontSize: 13,
        fontFamily: 'Nunito-Bold',
        color: '#333',
        textAlign: 'center',
    },
    summaryTextKo: {
        fontSize: 11,
        fontFamily: 'Pretendard-Regular',
        color: '#888',
        marginTop: 3,
        textAlign: 'center',
    },
});

export default OriginSegmentUI;
