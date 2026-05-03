import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppLang, tLang } from '../context/LanguageContext';
import { STRINGS } from '../i18n/strings';

const TransitStep = ({
    lineNumber,
    direction,
    directionKo,
    travelTime,
    stationCount,
    lineColor = '#7c65c1',
    isRealTime = false,
}) => {
    const { lang } = useAppLang();
    const isKo = lang === 'ko';

    const lineLabel = isKo ? `${lineNumber}호선` : `Line ${lineNumber}`;
    const directionLabel = direction || directionKo
        ? isKo
            ? `${directionKo || direction} ${tLang(STRINGS.transit.towards, lang)}`
            : `Towards ${direction || directionKo}`
        : null;
    const timeLabel = travelTime
        ? isKo ? `${travelTime}${tLang(STRINGS.transit.travelTime, lang)}` : `${travelTime} ${tLang(STRINGS.transit.travelTime, lang)}`
        : null;
    const stationsLabel = stationCount
        ? isKo ? `${stationCount}${tLang(STRINGS.transit.stationCount, lang)}` : `${stationCount} ${tLang(STRINGS.transit.stationCount, lang)}`
        : null;

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
                        <Text style={[styles.lineText, { fontFamily: isKo ? 'Pretendard-Bold' : 'Nunito-Bold' }]}>
                            {lineLabel}
                        </Text>
                        {isRealTime && (
                            <View style={styles.liveBadge}>
                                <View style={styles.liveDot} />
                                <Text style={styles.liveText}>{tLang(STRINGS.transit.live, lang)}</Text>
                            </View>
                        )}
                    </View>
                    {directionLabel && (
                        <Text style={[styles.directionText, { fontFamily: isKo ? 'Pretendard-Regular' : 'Nunito-Bold' }]}>
                            {directionLabel}
                        </Text>
                    )}
                </View>

                <View style={styles.detailsRow}>
                    {timeLabel && (
                        <View style={styles.detailBadge}>
                            <MaterialCommunityIcons name="clock-outline" size={12} color="#64748B" />
                            <Text style={[styles.detailText, { fontFamily: isKo ? 'Pretendard-Regular' : 'Nunito-Bold' }]}>
                                {timeLabel}
                            </Text>
                        </View>
                    )}
                    {stationsLabel && (
                        <View style={styles.detailBadge}>
                            <MaterialCommunityIcons name="train" size={12} color="#64748B" />
                            <Text style={[styles.detailText, { fontFamily: isKo ? 'Pretendard-Regular' : 'Nunito-Bold' }]}>
                                {stationsLabel}
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
        fontFamily: 'Nunito-Bold',
        color: '#ef4444',
        textTransform: 'uppercase',
    },
    directionText: {
        fontSize: 14,
        color: '#475569',
        marginTop: 2,
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
        color: '#64748B',
    },
});

export default TransitStep;
