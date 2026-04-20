import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Animated, Linking } from 'react-native';

import { TimelineCard } from './TimelineCard';
import { normalizeStationName } from '../../utils/textUtils';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLanguage, t } from '../../hooks/useLanguage';
import { STRINGS } from '../../i18n/strings';

type SelectedStation = any;
type TabMode = 'visual' | 'text';

interface ResultViewProps {
    from: SelectedStation;
    to: SelectedStation;
    onReSearch: () => void;
    routeData?: any;
    isLoading?: boolean;
    loadingStep?: string;
    stationNameMap?: Record<string, string>;
    lineMismatchNotice?: { selected: string; actual: string };
    errorType?: string | null;
    originExits?: string[];
    destExits?: string[];
    selectedOriginExit?: string | null;
    selectedDestExit?: string | null;
    onChangeOriginExit?: (exit: string) => void;
    onChangeDestExit?: (exit: string) => void;
    exitStatuses?: { origin: any[]; dest: any[] };
    isPartialLoading?: 'origin' | 'dest' | null;
}

const C = {
    primary:   '#C8362A',
    green:     '#C8362A',
    amber:     '#DA7756',
    amberBg:   '#FBF0EC',
    amberSel:  '#F5E0D8',
    border:    '#E8E8EE',
    textHigh:  '#111116',
    textMid:   '#3D3D4A',
    textMuted: '#AAABB8',
    surface:   '#FFFFFF',
    surfaceVar:'#F0F0F5',
};

export function ResultView({
    from, to, routeData, isLoading, stationNameMap = {}, lineMismatchNotice,
    errorType, originExits = [], destExits = [],
    selectedOriginExit, selectedDestExit,
    onChangeOriginExit, onChangeDestExit,
    exitStatuses = { origin: [], dest: [] },
    isPartialLoading = null,
}: ResultViewProps) {

    const lang = useLanguage();
    const [activeTab, setActiveTab] = useState<TabMode>('visual');
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        if (!isLoading) return;
        const pulse = (anim: Animated.Value) =>
            Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]);
        const anim = Animated.loop(Animated.stagger(200, [pulse(dot1), pulse(dot2), pulse(dot3)]));
        anim.start();
        return () => anim.stop();
    }, [isLoading]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const openGoogleMapsStation = (stationObj: any) => {
        const name = stationObj?.name_ko || stationObj?.ko || stationObj?.name || '';
        const query = encodeURIComponent(name + '역 서울');
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    };

    const getExitStatusDotColor = (exitNo: string, statuses: any[]): string => {
        if (!statuses?.length) return '#AAABB8';
        const matches = statuses.filter(s => String(s.vcntEntrcNo || '').includes(String(exitNo)));
        if (!matches.length) return '#AAABB8';
        return matches.every(s => s.oprtngSitu === 'M') ? '#2E5E4A' : '#C8362A';
    };

    const getExitStatusLabel = (color: string): string => {
        if (color === '#2E5E4A') return 'In service';
        if (color === '#AAABB8') return 'Status unknown';
        return 'Unavailable';
    };

    // ── Route building ────────────────────────────────────────────────────────
    const route = useMemo(() => {
        if (!routeData) return null;

        const rawItems: any[] = Array.isArray(routeData.rawItems) ? routeData.rawItems : [];
        const segments: any[] = [];

        rawItems.forEach((item: any, i: number) => {
            const isDeparture = i === 0;
            const isArrival   = i === rawItems.length - 1;
            const isTransfer  = item.transferYn === 'Y';

            if (isDeparture && from?.exit_no !== 'NONE' && Array.isArray(routeData.originSteps) && routeData.originSteps.length > 0) {
                segments.push({
                    station: { ...from, line: from?.line ?? from?.lines?.[0] },
                    steps: routeData.originSteps,
                    imgPaths: routeData.originImgPaths ?? [],
                    elevatorStatuses: routeData.rawItems?.[0]?.elevatorStatuses || [],
                    exitFallback: routeData.originExitFallback ?? false,
                    hashKey: routeData.originHashKey ?? null,
                });
            } else if (isTransfer) {
                const transferSteps = (Array.isArray(item.transitSteps) && item.transitSteps.length > 0)
                    ? item.transitSteps
                    : [{
                        order: 1,
                        short:  { en: `Transfer to ${rawItems[i + 1]?.lineNm || 'Next Line'}`, ko: `${rawItems[i + 1]?.lineNm || '다음 노선'}으로 환승` },
                        detail: { en: `Transfer to ${rawItems[i + 1]?.lineNm || 'Next Line'}`, ko: `${rawItems[i + 1]?.lineNm || '다음 노선'}으로 환승` },
                        floor_from: null, floor_to: null, type: 'move' as const,
                      }];

                segments.push({
                    station: {
                        id: 0,
                        name: stationNameMap[item.stnNm] || item.stnNm || 'Transfer',
                        ko: item.stnNm || '환승역',
                        line: item.lineNm ?? from?.line,
                        exit: 0,
                    },
                    transfer: true,
                    fromLine: item.lineNm ?? null,
                    toLine: item.transferToLineNm ?? rawItems[i + 1]?.lineNm ?? null,
                    steps: transferSteps,
                    imgPaths: item.transitImgPaths ?? [],
                    elevatorStatuses: item.elevatorStatuses || [],
                    hashKey: item.transitHashKey ?? null,
                });
            } else if (isArrival && to?.exit_no !== 'NONE' && Array.isArray(routeData.destinationSteps) && routeData.destinationSteps.length > 0) {
                segments.push({
                    station: { ...to, line: item.lineNm ?? to?.line },
                    steps: routeData.destinationSteps,
                    imgPaths: routeData.destinationImgPaths ?? [],
                    isDestination: true,
                    elevatorStatuses: routeData.rawItems?.[routeData.rawItems.length - 1]?.elevatorStatuses || [],
                    exitFallback: routeData.destinationExitFallback ?? false,
                    hashKey: routeData.destinationHashKey ?? null,
                });
            }

            const isKeyStop = isDeparture || isTransfer;
            if (!isArrival && isKeyStop) {
                const nextKeyIdx = rawItems.findIndex(
                    (x: any, j: number) => j > i && (x.transferYn === 'Y' || j === rawItems.length - 1)
                );
                const nextKeyItem = rawItems[nextKeyIdx];
                const stopsCount = (typeof item.stopCountToNext === 'number' && item.stopCountToNext > 0) ? item.stopCountToNext : null;
                const travelTime = (typeof item.travelTime === 'number' && item.travelTime > 0) ? item.travelTime : null;
                const rideLine = isTransfer ? (rawItems[i + 1]?.lineNm ?? item.lineNm) : item.lineNm;

                const boardingStnEn = (isDeparture ? from?.name : (stationNameMap[normalizeStationName(item.stnNm)] || stationNameMap[item.stnNm] || item.stnNm));
                const boardingStnKo = item.stnNm;
                const nextStnEn = stationNameMap[normalizeStationName(nextKeyItem.stnNm)] || stationNameMap[nextKeyItem.stnNm] || nextKeyItem.stnNm;

                const rideMetaEn = [
                    stopsCount !== null ? `${stopsCount} stop${stopsCount !== 1 ? 's' : ''}` : null,
                    travelTime !== null ? `~${travelTime} min` : null,
                ].filter(Boolean).join(' · ');
                const rideMetaKo = [
                    stopsCount !== null ? `${stopsCount}정거장` : null,
                    travelTime !== null ? `약 ${travelTime}분` : null,
                ].filter(Boolean).join(' · ');

                segments.push({
                    isRide: true,
                    station: {
                        id: -1,
                        name: nextStnEn,
                        ko: nextKeyItem.stnNm,
                        line: rideLine,
                        exit: 0,
                        intermediateStations: (item.intermediateStations || []).filter((s: string) =>
                            normalizeStationName(s) !== normalizeStationName(item.stnNm) &&
                            normalizeStationName(s) !== normalizeStationName(nextKeyItem.stnNm)
                        )
                    },
                    steps: [{
                        type: 'board' as const,
                        icon: '🚇',
                        en: `${boardingStnEn} → ${nextStnEn}${rideMetaEn ? ` (${rideMetaEn})` : ''}`,
                        ko: `${boardingStnKo} 탑승 → ${nextKeyItem.stnNm} 방면${rideMetaKo ? ` (${rideMetaKo})` : ''}`,
                    }],
                });
            }
        });

        if (segments.length === 0 && rawItems.length > 0) {
            const makeStep = (en: string, ko: string) => ([{
                order: 1,
                short: { en, ko }, detail: { en, ko },
                floor_from: null, floor_to: null, type: 'move' as const,
            }]);
            if (from?.exit_no !== 'NONE') {
                segments.push({ station: from, steps: makeStep(`Board at ${from?.name ?? from?.ko}`, `${from?.ko ?? from?.name} 탑승`), imgPaths: [] });
            }
            rawItems.forEach((item: any, i: number) => {
                if (item.transferYn === 'Y' && i < rawItems.length - 1) {
                    segments.push({
                        station: { id: i, name: item.stnNm, ko: item.stnNm, line: item.lineNm, exit: 0 },
                        transfer: true,
                        steps: makeStep(`Transfer to ${rawItems[i + 1]?.lineNm}`, `${rawItems[i + 1]?.lineNm} 환승`),
                        imgPaths: [],
                    });
                }
            });
            if (to?.exit_no !== 'NONE') {
                segments.push({ station: to, steps: makeStep(`Arrival at ${to?.name ?? to?.ko}`, `${to?.ko ?? to?.name} 도착`), imgPaths: [], isDestination: true });
            }
        }

        return segments.length > 0 ? segments : null;
    }, [routeData, from, to, stationNameMap]);

    // ── Loading state ─────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F7F7FA' }}>
                <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 18, fontFamily: 'Nunito-ExtraBold', color: '#111116', textAlign: 'center' }}>
                        Finding your route and mapping elevator paths.
                    </Text>
                    <Text style={{ fontSize: 13, fontFamily: 'Pretendard-Regular', color: '#AAABB8', marginTop: 8, textAlign: 'center' }}>
                        지하철 경로 탐색 및 역내 엘리베이터 동선 안내 준비 중
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 40 }}>
                    {[dot1, dot2, dot3].map((anim, i) => (
                        <Animated.View
                            key={i}
                            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#C8362A', opacity: anim }}
                        />
                    ))}
                </View>
            </View>
        );
    }

    // ── Empty / error state ───────────────────────────────────────────────────
    if (!from || !to || !route) {
        const isUnsupportedLine = errorType === 'unsupported_line';
        const S = STRINGS.route;
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F7F7FA' }}>
                <MaterialCommunityIcons name="subway-alert-variant" size={64} color="#C8362A" />
                <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: '#18181B', marginTop: 24, textAlign: 'center' }}>
                    {isUnsupportedLine ? t(S.unsupportedLineTitle, lang) : t(S.noRouteTitle, lang)}
                </Text>
                <Text style={{ fontSize: 14, color: '#52525B', marginTop: 4, textAlign: 'center' }}>
                    {isUnsupportedLine ? t(S.unsupportedLineDesc, lang) : t(S.noRouteDesc, lang)}
                </Text>
                {isUnsupportedLine && (
                    <Text style={{ fontSize: 11, color: '#AAABB8', marginTop: 8, textAlign: 'center' }}>
                        {t(S.unsupportedLineHint, lang)}
                    </Text>
                )}
            </View>
        );
    }

    const isVisual = activeTab === 'visual';
    const hasMultipleOriginExits = originExits.length > 1;
    const hasMultipleDestExits   = destExits.length > 1;
    const showExitPanel = hasMultipleOriginExits || hasMultipleDestExits;

    // ── Route timeline ────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1 }}>

            {/* ── Tab switcher ── */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                borderBottomWidth: 1,
                borderBottomColor: '#E8E8EE',
                paddingVertical: 6,
            }}>
                {(['visual', 'text'] as TabMode[]).map((tab, idx) => {
                    const active = activeTab === tab;
                    return (
                        <React.Fragment key={tab}>
                            {idx === 1 && <View style={{ width: 1, height: 18, backgroundColor: '#E8E8EE' }} />}
                            <TouchableOpacity
                                onPress={() => setActiveTab(tab)}
                                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6 }}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons
                                    name={tab === 'visual' ? 'image-outline' : 'text'}
                                    size={15}
                                    color={active ? '#C8362A' : '#AAABB8'}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={{ fontSize: 13, fontFamily: active ? 'Nunito-Bold' : 'Nunito-Medium', color: active ? '#C8362A' : '#AAABB8' }}>
                                    {tab === 'visual' ? 'Visual Guide' : 'Text Guide'}
                                </Text>
                            </TouchableOpacity>
                        </React.Fragment>
                    );
                })}
            </View>

            {/* ── Line mismatch notice ── */}
            {lineMismatchNotice && !isLoading && (
                <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: '#FBF0EC',
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderBottomWidth: 1, borderBottomColor: '#E8C4B4',
                }}>
                    <MaterialCommunityIcons name="information-outline" size={15} color="#8D6E0A" style={{ marginRight: 6 }} />
                    <Text style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#8D6E0A' }}>
                            {`Arrives via Line ${lineMismatchNotice.actual} (selected: Line ${lineMismatchNotice.selected})  `}
                        </Text>
                        <Text style={{ fontSize: 9, color: '#8D6E0A' }}>
                            {`${lineMismatchNotice.actual}호선 도착 (선택: ${lineMismatchNotice.selected}호선)`}
                        </Text>
                    </Text>
                </View>
            )}

            {/* ── Scrollable card list ── */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120, paddingTop: 10 }}
            >
                {route.map((seg: any, i: number) => {
                    const routeKey = `${from?.id}_${to?.id}_${from?.exit_no}_${to?.exit_no}`;
                    return (
                        <View key={i} style={{ marginBottom: i < route.length - 1 ? 0 : 16 }}>
                            <TimelineCard
                                segment={seg}
                                viewMode={isVisual ? 'summary' : 'detail'}
                                stationNameMap={stationNameMap}
                                hideImages={false}
                                routeKey={routeKey}
                                segmentIndex={i}
                                hashKey={seg.hashKey}
                            />
                            {i < route.length - 1 && (
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{ width: 2, height: 16, backgroundColor: '#AAABB8' }} />
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* ── Exit Selection Panel ── */}
                {showExitPanel && (
                    <View style={{
                        marginTop: 16,
                        borderRadius: 16,
                        borderWidth: 1,
                        borderColor: '#E8C4B4',
                        backgroundColor: C.amberBg,
                        overflow: 'hidden',
                    }}>
                        {/* Header — 경로카드와 다른 앰버 톤 */}
                        <View style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#E8C4B4',
                            backgroundColor: '#F5E0D8',
                        }}>
                            <MaterialCommunityIcons name="door-open" size={16} color={C.amber} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: '#92400E' }}>
                                    Exit Options
                                </Text>
                                <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: '#B45309', marginTop: 1 }}>
                                    출구 선택 · 탭하여 해당 구간 경로를 변경하세요
                                </Text>
                            </View>
                        </View>

                        <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 }}>

                            {/* Departure exits */}
                            {hasMultipleOriginExits && (
                                <View style={{ marginBottom: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{
                                            backgroundColor: C.amber,
                                            paddingHorizontal: 7, paddingVertical: 2,
                                            borderRadius: 9999, marginRight: 8,
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'Nunito-ExtraBold' }}>DEPARTURE</Text>
                                        </View>
                                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.textHigh }}>
                                            {from?.name}
                                        </Text>
                                        <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: C.textMuted, marginLeft: 5 }}>
                                            출발
                                        </Text>
                                        {isPartialLoading === 'origin' && (
                                            <Text style={{ fontSize: 10, fontFamily: 'Nunito-Medium', color: C.amber, marginLeft: 8 }}>
                                                Updating...
                                            </Text>
                                        )}
                                    </View>

                                    {originExits.map((ex: string) => {
                                        const isSelected = ex === selectedOriginExit;
                                        const dotColor = getExitStatusDotColor(ex, exitStatuses.origin);
                                        return (
                                            <TouchableOpacity
                                                key={ex}
                                                onPress={() => onChangeOriginExit?.(ex)}
                                                activeOpacity={0.7}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 9,
                                                    paddingHorizontal: 12,
                                                    marginBottom: 6,
                                                    borderRadius: 10,
                                                    borderWidth: 1.5,
                                                    borderColor: isSelected ? C.amber : '#E8C4B4',
                                                    backgroundColor: isSelected ? C.amberSel : '#FFFFF8',
                                                }}
                                            >
                                                <View style={{
                                                    width: 8, height: 8, borderRadius: 4,
                                                    backgroundColor: dotColor,
                                                    marginRight: 10,
                                                }} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: isSelected ? '#92400E' : C.textHigh }}>
                                                        Exit {ex}
                                                    </Text>
                                                    <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: dotColor, marginTop: 1 }}>
                                                        {getExitStatusLabel(dotColor)}
                                                    </Text>
                                                </View>
                                                {isSelected && (
                                                    <View style={{
                                                        backgroundColor: C.amber,
                                                        paddingHorizontal: 8, paddingVertical: 3,
                                                        borderRadius: 9999,
                                                    }}>
                                                        <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: '#fff' }}>Selected</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Arrival exits */}
                            {hasMultipleDestExits && (
                                <View style={{ marginBottom: 14 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={{
                                            backgroundColor: C.green,
                                            paddingHorizontal: 7, paddingVertical: 2,
                                            borderRadius: 9999, marginRight: 8,
                                        }}>
                                            <Text style={{ color: '#fff', fontSize: 9, fontFamily: 'Nunito-ExtraBold' }}>ARRIVAL</Text>
                                        </View>
                                        <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.textHigh }}>
                                            {to?.name}
                                        </Text>
                                        <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: C.textMuted, marginLeft: 5 }}>
                                            도착
                                        </Text>
                                        {isPartialLoading === 'dest' && (
                                            <Text style={{ fontSize: 10, fontFamily: 'Nunito-Medium', color: C.amber, marginLeft: 8 }}>
                                                Updating...
                                            </Text>
                                        )}
                                    </View>

                                    {destExits.map((ex: string) => {
                                        const isSelected = ex === selectedDestExit;
                                        const dotColor = getExitStatusDotColor(ex, exitStatuses.dest);
                                        return (
                                            <TouchableOpacity
                                                key={ex}
                                                onPress={() => onChangeDestExit?.(ex)}
                                                activeOpacity={0.7}
                                                style={{
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    paddingVertical: 9,
                                                    paddingHorizontal: 12,
                                                    marginBottom: 6,
                                                    borderRadius: 10,
                                                    borderWidth: 1.5,
                                                    borderColor: isSelected ? C.green : '#E8D9A8',
                                                    backgroundColor: isSelected ? '#EDF5F1' : '#FFFFF8',
                                                }}
                                            >
                                                <View style={{
                                                    width: 8, height: 8, borderRadius: 4,
                                                    backgroundColor: dotColor,
                                                    marginRight: 10,
                                                }} />
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ fontSize: 14, fontFamily: 'Nunito-Bold', color: isSelected ? C.green : C.textHigh }}>
                                                        Exit {ex}
                                                    </Text>
                                                    <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: dotColor, marginTop: 1 }}>
                                                        {getExitStatusLabel(dotColor)}
                                                    </Text>
                                                </View>
                                                {isSelected && (
                                                    <View style={{
                                                        backgroundColor: C.green,
                                                        paddingHorizontal: 8, paddingVertical: 3,
                                                        borderRadius: 9999,
                                                    }}>
                                                        <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: '#fff' }}>Selected</Text>
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Google Maps station links */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, marginTop: 4 }}>
                                <TouchableOpacity onPress={() => openGoogleMapsStation(from)} activeOpacity={0.6}
                                    style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#AAABB8" style={{ marginRight: 3 }} />
                                    <Text style={{ fontSize: 11, fontFamily: 'Nunito-Medium', color: '#AAABB8', textDecorationLine: 'underline' }}>
                                        {from?.name} on Maps
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => openGoogleMapsStation(to)} activeOpacity={0.6}
                                    style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#AAABB8" style={{ marginRight: 3 }} />
                                    <Text style={{ fontSize: 11, fontFamily: 'Nunito-Medium', color: '#AAABB8', textDecorationLine: 'underline' }}>
                                        {to?.name} on Maps
                                    </Text>
                                </TouchableOpacity>
                            </View>

                        </View>
                    </View>
                )}
            </ScrollView>

        </View>
    );
}
