import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    SafeAreaView,
    TouchableOpacity,
} from 'react-native';
import { getLineColor, getLineBadgeLabel } from '../utils/lineColors';
import { translateLocation, synthesizeLocation, checkIsInside } from '../utils/translation';
import TimelineContainer from '../components/TimelineContainer';
import { useAppLang, pick } from '../context/LanguageContext';
import { STRINGS, formatWithVars } from '../i18n/strings';

const NAVY = '#3d2f7a';

const FacilityItem = ({ icon, labelEn, labelKo, subEn, subKo, tagEn, tagKo, tagColor, lang }) => {
    const label = pick(labelEn, labelKo, lang);
    const sub = pick(subEn, subKo, lang);
    const tag = pick(tagEn, tagKo, lang);
    return (
        <View style={styles.facilityItem}>
            <View style={styles.facilityIconWrap}>
                <Text style={styles.facilityIcon}>{icon}</Text>
            </View>
            <View style={styles.facilityContent}>
                <View style={styles.facilityTitleRow}>
                    <View style={styles.facilityTextGroup}>
                        <Text style={styles.facilityLabel}>{label}</Text>
                    </View>
                    {tag && (
                        <View style={[styles.facilityTag, { backgroundColor: tagColor || '#f0ecff' }]}>
                            <Text style={[styles.facilityTagText, { color: tagColor ? '#fff' : '#7c65c1' }]}>{tag}</Text>
                        </View>
                    )}
                </View>
                {sub ? (
                    <View style={styles.facilitySubGroup}>
                        <Text style={styles.facilitySub}>{sub}</Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
};

const LineCircle = ({ line }) => {
    if (!line) return null;
    const label = getLineBadgeLabel(line);
    const color = getLineColor(line);
    const fontSize = label.length <= 1 ? 14 : label.length === 2 ? 10 : 9;
    return (
        <View style={[styles.lineCircle, { backgroundColor: color }]}>
            <Text style={[styles.lineCircleText, { fontSize }]}>{label}</Text>
        </View>
    );
};

export default function FacilityScreen({ route, navigation }) {
    const { lang } = useAppLang();
    const { nameEn, nameKo, lines = [], facilities = [] } = route.params || {};

    return (
        <SafeAreaView style={styles.safeArea}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Header Summary */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <View style={styles.headerTitleRow}>
                            <Text style={styles.stationNameEn}>{nameEn}</Text>
                            <View style={styles.lineList}>
                                {lines.map(l => <LineCircle key={l} line={l} />)}
                            </View>
                        </View>
                        <Text style={styles.stationNameKo}>{nameKo}</Text>
                    </View>
                </View>

                <View style={styles.pageTitleArea}>
                    <Text style={styles.pageTitle}>{pick('Station Facilities', '역내 편의시설 안내', lang)}</Text>
                </View>


                <View style={[styles.sectionBlock, { marginTop: 10 }]}>
                    <View style={styles.sectionHeading}>
                        <View style={styles.sectionIconWrap}>
                            <Text style={styles.sectionHeadingIcon}>✨</Text>
                        </View>
                        <View>
                            <Text style={styles.sectionHeadingTitle}>Convenience Services</Text>
                            <Text style={styles.sectionHeadingSubtitle}>{pick('Location & gate details', '상세 위치 및 게이트 정보', lang)}</Text>
                        </View>
                    </View>

                    <View style={styles.facilityList}>
                        {facilities.length > 0 ? (
                            facilities.map((f, idx) => {
                                // Grouped rendering for facilities with multiple locations (Toilet, Locker, Nursing, Lift)
                                const isGroupable = ['toilet', 'disabled_toilet', 'nursing', 'lift', 'locker'].includes(f.id);
                                if (isGroupable && f.rawData && f.rawData.length > 0) {
                                    const isDisabled = f.id === 'disabled_toilet';
                                    const icon = f.id === 'toilet' ? "🚽" : isDisabled ? "♿" : f.id === 'nursing' ? "🍼" : f.id === 'lift' ? "🛗" : "🧳";

                                    // Identify common tag
                                    const firstItem = f.rawData[0];
                                    const isInside = checkIsInside(firstItem);

                                    return (
                                        <View key={f.id} style={styles.groupedContainer}>
                                            <View style={styles.groupedHeader}>
                                                <View style={styles.facilityIconWrap}>
                                                    <Text style={styles.facilityIcon}>{icon}</Text>
                                                </View>
                                                <View style={styles.facilityContent}>
                                                    <View style={styles.facilityTitleRow}>
                                                        <View style={styles.facilityTextGroup}>
                                                            <Text style={styles.facilityLabel}>{pick(f.labelEn, f.labelKo, lang)}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={styles.subLocationsList}>
                                                {f.rawData.map((item, ridx) => {
                                                    const locKo = synthesizeLocation(item, 'dtlLoc');
                                                    const locEn = translateLocation(locKo);

                                                    const itemIsInside = checkIsInside(item);

                                                    return (
                                                        <View key={`${f.id}_${ridx}`} style={styles.subLocItem}>
                                                            <View style={[styles.itemGateIndicator, { backgroundColor: itemIsInside ? '#2e7d32' : '#ed6c02' }]}>
                                                                <Text style={styles.itemGateText}>{itemIsInside ? 'IN' : 'OUT'}</Text>
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={styles.subLoc}>{pick(locEn, locKo, lang)}</Text>
                                                                {(item.mlFmlDvNm || item.toltNum || item.diapExchNum) && (
                                                                    <View style={styles.itemExtraRow}>
                                                                        {item.mlFmlDvNm && (
                                                                            <Text style={styles.itemExtraTag}>{item.mlFmlDvNm === '남자' ? 'Male' : item.mlFmlDvNm === '여자' ? 'Female' : item.mlFmlDvNm}</Text>
                                                                        )}
                                                                        {item.toltNum && <Text style={styles.itemExtraText}>• {item.toltNum} Units</Text>}
                                                                        {item.diapExchNum && <Text style={styles.itemExtraText}>• Diaper Exchange</Text>}
                                                                    </View>
                                                                )}
                                                            </View>
                                                            {item.telNo && (
                                                                <Text style={styles.telText}>{item.telNo}</Text>
                                                            )}
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                            {idx < facilities.length - 1 && <View style={styles.facilityDivider} />}
                                        </View>
                                    );
                                }


                                return (
                                    <View key={f.id}>
                                        <FacilityItem {...f} lang={lang} />
                                        {idx < facilities.length - 1 && <View style={styles.facilityDivider} />}
                                    </View>
                                );
                            })
                        ) : (
                            <View style={styles.emptyBox}>
                                <Text style={styles.emptyText}>No facility information available</Text>
                            </View>
                        )}
                    </View>
                </View>



            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f4f2fb' },
    scrollContent: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#e8e4f8'
    },
    headerLeft: { flex: 1 },
    stationNameEn: { fontSize: 22, fontWeight: '800', color: '#1a1040' },
    stationNameKo: { fontSize: 13, color: '#757575', marginTop: 1 },
    headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    lineList: { flexDirection: 'row', gap: 4, marginTop: 2 },
    lineCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    lineCircleText: { color: '#fff', fontWeight: '800' },

    pageTitleArea: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 4,
        alignItems: 'center'
    },
    pageTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: '#3d2f7a', letterSpacing: -0.5 },

    sectionBlock: {
        marginHorizontal: 16,
        marginTop: 20,
        backgroundColor: '#ffffff',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#e8e8e8',
        overflow: 'hidden'
    },
    sectionHeading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        backgroundColor: '#fafafa'
    },
    sectionIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ede9f8', alignItems: 'center', justifyContent: 'center' },
    sectionHeadingIcon: { fontSize: 14 },
    sectionHeadingTitle: { fontSize: 15, fontFamily: 'Nunito-Bold', color: '#212121' },
    sectionHeadingSubtitle: { fontSize: 11, color: '#9e9e9e' },

    facilityList: { paddingHorizontal: 16 },
    facilityItem: { flexDirection: 'row', paddingVertical: 16, alignItems: 'flex-start' },
    facilityDivider: { height: 1, backgroundColor: '#f0f0f0' },
    facilityIconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    facilityIcon: { fontSize: 18 },
    facilityContent: { flex: 1 },
    facilityTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    facilityTextGroup: { flex: 1, marginRight: 8 },
    facilityLabel: { fontSize: 15, fontFamily: 'Nunito-Bold', color: '#212121' },
    facilityTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    facilityTagText: { fontSize: 10, fontFamily: 'Nunito-ExtraBold' },
    facilitySubGroup: { marginTop: 8, backgroundColor: '#f8f9fa', padding: 10, borderRadius: 8 },
    facilitySub: { fontSize: 12, color: '#424242', fontFamily: 'Nunito-Medium' },

    // Grouped Styles
    groupedContainer: { paddingVertical: 8 },
    groupedHeader: { flexDirection: 'row', paddingVertical: 12, alignItems: 'center' },
    subLocationsList: { backgroundColor: '#f8f9fa', borderRadius: 10, padding: 12, marginBottom: 16, marginLeft: 48 },
    subLocItem: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    itemGateIndicator: { width: 32, height: 16, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 2 },
    itemGateText: { fontSize: 9, fontFamily: 'Nunito-ExtraBold', color: '#fff' },
    subLoc: { fontSize: 13, fontFamily: 'Nunito-SemiBold', color: '#212121' },
    itemExtraRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 6 },
    itemExtraTag: { fontSize: 10, color: '#3d2f7a', backgroundColor: '#eeebff', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, fontFamily: 'Nunito-Bold' },
    itemExtraText: { fontSize: 10, color: '#757575' },
    telText: { fontSize: 11, color: '#3498db', fontFamily: 'Nunito-Bold' },

    infoBox: { marginHorizontal: 16, marginTop: 20, padding: 16, backgroundColor: '#fffbe6', borderRadius: 12, borderWidth: 1, borderColor: '#ffe58f' },
    infoTitle: { fontSize: 14, fontFamily: 'Nunito-Bold', color: '#856404', marginBottom: 4 },
    infoText: { fontSize: 12, color: '#856404', lineHeight: 18 },

    emptyBox: { padding: 40, alignItems: 'center' },
    emptyText: { color: '#9e9e9e', fontSize: 14 },
    timelinePadding: {
        paddingVertical: 8,
    }
});
