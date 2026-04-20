/**
 * RoutePreviewScreen
 * Primary: #C8362A (Dancheong Red)
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    StatusBar, Image,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ArrowUpDown, Luggage, Map } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ResultView } from '../components/route/ResultView';
import { SearchingView } from '../components/route/SearchingView';
import { LINE_COLORS } from '../constants/data';
import { getLineColor, getLineBadgeLabel } from '../utils/lineColors';
import { RouteService } from '../services/RouteService';
import { supabase } from '../../lib/supabase';
import { fetchSeoulElevatorStatus } from '../api/seoulApi';


const C = {
    primary:    '#C8362A',
    bg:         '#F7F7FA',
    surface:    '#FFFFFF',
    surfaceVar: '#EEEEF3',
    border:     '#E8E8EE',
    textHigh:   '#111116',
    textMid:    '#3D3D4A',
    textLow:    '#8A9CA3',
    textMuted:  '#AAABB8',
    green:      '#2E5E4A',
    red:        '#C8362A',
};

export default function RoutePreviewScreen() {
    const insets = useSafeAreaInsets();

    const [origin, setOrigin]           = useState(null);
    const [destination, setDestination] = useState(null);
    const [view, setView]               = useState('idle');
    const [routeData, setRouteData]     = useState(null);
    const [isLoading, setIsLoading]     = useState(false);
    const [loadingStep, setLoadingStep] = useState(null);
    const [searchType, setSearchType]   = useState(null);
    const [stationNameMap, setStationNameMap] = useState({});
    const [lineMismatchNotice, setLineMismatchNotice] = useState(null);
    const [routeError, setRouteError] = useState(null);

    const [originExits, setOriginExits]           = useState([]);
    const [destExits, setDestExits]               = useState([]);
    const [currentOriginExit, setCurrentOriginExit] = useState(null);
    const [currentDestExit, setCurrentDestExit]   = useState(null);
    const [exitStatuses, setExitStatuses]         = useState({ origin: [], dest: [] });
    const [routeCandidate, setRouteCandidate]     = useState(null);
    const [routeSvc, setRouteSvc]                 = useState(null);
    const [isPartialLoading, setIsPartialLoading] = useState(null); // 'origin' | 'dest' | null

    const prevRouteKey = useRef(null);

    // ── Reset to idle if fields cleared ──────────────────────────────────────
    useEffect(() => {
        if (!origin || !destination) {
            if (view === 'result') setView('idle');
        }
    }, [origin, destination]);

    // ── Helper: pick smallest "In Service" exit, fallback to first ───────────
    const _getBestExit = (exits, statuses) => {
        if (!exits.length) return null;
        if (!statuses.length) return exits[0];
        const inService = exits.filter(ex => {
            const matches = statuses.filter(s => String(s.vcntEntrcNo || '').includes(String(ex)));
            return matches.length > 0 && matches.every(s => s.oprtngSitu === 'M');
        });
        return inService.length > 0 ? inService[0] : exits[0];
    };

    // ── Fetch elevator statuses when multiple exits are available ─────────────
    useEffect(() => {
        if (originExits.length <= 1 && destExits.length <= 1) {
            setExitStatuses({ origin: [], dest: [] });
            return;
        }
        const nameOrigin = origin?.name_ko || origin?.ko || '';
        const nameDest   = destination?.name_ko || destination?.ko || '';
        (async () => {
            const [originSt, destSt] = await Promise.all([
                (nameOrigin && originExits.length > 1) ? fetchSeoulElevatorStatus(nameOrigin) : Promise.resolve([]),
                (nameDest   && destExits.length > 1)   ? fetchSeoulElevatorStatus(nameDest)   : Promise.resolve([]),
            ]);
            setExitStatuses({ origin: originSt, dest: destSt });

            // Auto-switch to "In Service" exit if available and different from current
            if (!routeCandidate || !routeSvc) return;
            const bestOrigin = _getBestExit(originExits, originSt);
            const bestDest   = _getBestExit(destExits, destSt);
            const oChanged = bestOrigin && bestOrigin !== currentOriginExit;
            const dChanged = bestDest   && bestDest   !== currentDestExit;
            if (!oChanged && !dChanged) return;

            const newOrigin = oChanged ? bestOrigin : currentOriginExit;
            const newDest   = dChanged ? bestDest   : currentDestExit;
            if (oChanged) { setCurrentOriginExit(newOrigin); setOrigin(prev => ({ ...prev, exit: newOrigin, exit_no: newOrigin })); }
            if (dChanged) { setCurrentDestExit(newDest);     setDestination(prev => ({ ...prev, exit: newDest, exit_no: newDest })); }
            setIsPartialLoading(oChanged ? 'origin' : 'dest');
            try {
                const finalRoute = await routeSvc.finalizeRoute(routeCandidate, newOrigin, newDest, origin.id, destination.id);
                await _handleFinalRouteReady(finalRoute);
            } catch (e) {
                console.log('auto exit re-select error:', e);
            }
            setIsPartialLoading(null);
        })();
    }, [originExits, destExits]);

    // ── Final route ready ─────────────────────────────────────────────────────
    const _handleFinalRouteReady = async (data) => {
        setRouteData(data);
        const normalize = (name) => name?.replace(/역$/, '') ?? name;
        const rawNames = [...new Set([
            ...(data?.rawItems ?? []).map(item => item.stnNm),
            ...(data?.rawItems ?? []).flatMap(item => item.intermediateStations || [])
        ].filter(Boolean))];
        const queryNames = [...new Set([...rawNames, ...rawNames.map(normalize)])];

        if (queryNames.length > 0) {
            const { data: rows } = await supabase
                .from('stations')
                .select('name_ko, name_en')
                .in('name_ko', queryNames);
            if (rows) {
                const map = {};
                rows.forEach(r => {
                    map[r.name_ko] = r.name_en;
                    const norm = normalize(r.name_ko);
                    map[norm] = r.name_en;
                    map[norm + '역'] = r.name_en;
                });
                setStationNameMap(map);
            }
        }
        setIsLoading(false);
        setLoadingStep(null);
    };

    // ── Initial route search ──────────────────────────────────────────────────
    const handleFindRoute = () => {
        if (!origin || !destination) return;
        const key = `${origin.id}_${destination.id}`;
        prevRouteKey.current = key;

        setIsLoading(true);
        setLoadingStep('finding');
        setView('result');
        setRouteData(null);
        setStationNameMap({});
        setRouteError(null);
        setOriginExits([]);
        setDestExits([]);
        setCurrentOriginExit(null);
        setCurrentDestExit(null);
        setRouteCandidate(null);
        setRouteSvc(null);

        (async () => {
            try {
                const svc = new RouteService();
                const exitsData = await svc.getRouteAndAvailableExits(origin, destination, setLoadingStep);

                if (!exitsData || !exitsData.candidate) {
                    setIsLoading(false);
                    return;
                }

                const oExits = exitsData.originExits || [];
                const dExits = exitsData.destExits || [];
                setOriginExits(oExits);
                setDestExits(dExits);
                setRouteCandidate(exitsData.candidate);
                setRouteSvc(svc);

                setLineMismatchNotice(null);

                // Always auto-select lowest (first) exit
                const oExit = oExits[0] || origin.exit_no || '1';
                const dExit = dExits[0] || destination.exit_no || '1';
                setCurrentOriginExit(oExit);
                setCurrentDestExit(dExit);

                setOrigin(prev => ({ ...prev, exit: oExit, exit_no: oExit }));
                setDestination(prev => ({ ...prev, exit: dExit, exit_no: dExit }));

                const finalRoute = await svc.finalizeRoute(
                    exitsData.candidate, oExit, dExit, origin.id, destination.id, setLoadingStep
                );
                await _handleFinalRouteReady(finalRoute);
            } catch (e) {
                console.log('route error:', e);
                if (e?.message === 'UNSUPPORTED_LINE_TRANSFER') {
                    setRouteError('unsupported_line');
                }
                setIsLoading(false);
            }
        })();
    };

    // ── Partial re-search: origin exit changed ────────────────────────────────
    const handleChangeOriginExit = async (newExit) => {
        if (!routeCandidate || !routeSvc || newExit === currentOriginExit) return;
        setCurrentOriginExit(newExit);
        setOrigin(prev => ({ ...prev, exit: newExit, exit_no: newExit }));
        setIsPartialLoading('origin');
        try {
            const finalRoute = await routeSvc.finalizeRoute(
                routeCandidate, newExit, currentDestExit, origin.id, destination.id
            );
            await _handleFinalRouteReady(finalRoute);
        } catch (e) {
            console.log('origin exit change error:', e);
        }
        setIsPartialLoading(null);
    };

    // ── Partial re-search: dest exit changed ──────────────────────────────────
    const handleChangeDestExit = async (newExit) => {
        if (!routeCandidate || !routeSvc || newExit === currentDestExit) return;
        setCurrentDestExit(newExit);
        setDestination(prev => ({ ...prev, exit: newExit, exit_no: newExit }));
        setIsPartialLoading('dest');
        try {
            const finalRoute = await routeSvc.finalizeRoute(
                routeCandidate, currentOriginExit, newExit, origin.id, destination.id
            );
            await _handleFinalRouteReady(finalRoute);
        } catch (e) {
            console.log('dest exit change error:', e);
        }
        setIsPartialLoading(null);
    };

    // ── Station selection handlers ────────────────────────────────────────────
    const handleSelectStation = (station) => {
        const selected = { ...station, name_ko: station.ko };
        if (searchType === 'origin') setOrigin(selected);
        else setDestination(selected);
        setSearchType(null);
    };

    const handleSwap = () => {
        const temp = origin;
        setOrigin(destination);
        setDestination(temp);
    };

    // ── Search row component ──────────────────────────────────────────────────
    const SearchRow = ({ type }) => {
        const isOrigin = type === 'origin';
        const value    = isOrigin ? origin : destination;

        return (
            <TouchableOpacity
                onPress={() => setSearchType(type)}
                activeOpacity={0.7}
                style={{
                    paddingHorizontal: 16,
                    paddingTop: isOrigin ? 18 : 10,
                    paddingBottom: isOrigin ? 10 : 18,
                    backgroundColor: '#FFFFFF',
                }}
            >
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 24 }}>
                        <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                            {isOrigin ? (
                                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#DA7756' }} />
                            ) : (
                                <MaterialCommunityIcons name="map-marker" size={17} color={C.green} />
                            )}
                        </View>
                        <View style={{ width: 10 }} />
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            {value ? (
                                <>
                                    <Text style={{ fontSize: 19, fontFamily: 'Nunito-ExtraBold', color: C.textHigh, flex: 1 }} numberOfLines={1}>
                                        {value.name}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 6 }}>
                                        {(value.lines || (value.line ? [value.line] : [])).map(l => (
                                            <View key={l} style={{
                                                width: 20, height: 20, borderRadius: 10,
                                                backgroundColor: getLineColor(l),
                                                alignItems: 'center', justifyContent: 'center',
                                                marginLeft: 3,
                                            }}>
                                                <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Nunito-Bold' }}>{getLineBadgeLabel(l)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            ) : (
                                <Text style={{ fontSize: 18, fontFamily: 'Nunito-Bold', color: C.textLow, flex: 1 }}>
                                    {isOrigin ? 'Starting Station' : 'Arrival Station'}
                                </Text>
                            )}
                        </View>
                        {value ? (
                            <TouchableOpacity
                                onPress={() => isOrigin ? setOrigin(null) : setDestination(null)}
                                style={{ paddingLeft: 8 }}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <MaterialCommunityIcons name="close-circle" size={20} color={C.textLow} />
                            </TouchableOpacity>
                        ) : (
                            <MaterialCommunityIcons name="magnify" size={20} color={C.textLow} style={{ paddingLeft: 8 }} />
                        )}
                    </View>
                    <View style={{ marginLeft: 32 }}>
                        {value ? (
                            <Text style={{ fontSize: 13, fontFamily: 'Pretendard-Regular', color: C.textMid, marginTop: 1 }} numberOfLines={1}>
                                {value.ko.endsWith('역') ? value.ko : value.ko + '역'}
                            </Text>
                        ) : (
                            <Text style={{ fontSize: 13, fontFamily: 'Pretendard-Regular', color: C.textLow, marginTop: 1 }} numberOfLines={1}>
                                {isOrigin ? '출발역' : '도착역'}
                            </Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: C.bg }}>
            <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

            {view === 'result' ? (
                <View style={{ flex: 1 }}>

                    {/* ── Result Top Bar ── */}
                    <View style={{
                        paddingTop: Math.max(insets.top, 12) + 10,
                        paddingBottom: 12,
                        paddingHorizontal: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: C.surface,
                        borderBottomWidth: 1,
                        borderBottomColor: C.border,
                    }}>
                        <TouchableOpacity
                            onPress={() => {
                                setView('idle');
                                setOrigin(null);
                                setDestination(null);
                                setRouteData(null);
                                setLineMismatchNotice(null);
                            }}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}
                            accessibilityLabel="Go back"
                        >
                            <MaterialCommunityIcons name="arrow-left" size={22} color={C.textHigh} />
                        </TouchableOpacity>

                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: C.surfaceVar,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: C.border,
                                borderLeftWidth: 3,
                                borderLeftColor: getLineColor(routeCandidate?.rawItems?.[0]?.lineNm),
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                marginRight: 6,
                                overflow: 'hidden',
                            }}>
                                {(() => {
                                    const lineNm = routeCandidate?.rawItems?.[0]?.lineNm;
                                    return lineNm ? (
                                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: getLineColor(lineNm), alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0 }}>
                                            <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Nunito-Bold' }}>{getLineBadgeLabel(lineNm)}</Text>
                                        </View>
                                    ) : null;
                                })()}
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.textHigh, flexShrink: 1 }} numberOfLines={1}>
                                        {origin?.name ?? '—'}
                                    </Text>
                                    <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: C.textMid, marginTop: 1 }} numberOfLines={1}>
                                        {origin?.ko ? (origin.ko.endsWith('역') ? origin.ko : origin.ko + '역') : ''}
                                    </Text>
                                </View>
                            </View>

                            <Image
                                source={require('../../assets/route.png')}
                                style={{ width: 28, height: 28, flexShrink: 0 }}
                                resizeMode="contain"
                            />

                            <View style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: C.surfaceVar,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: C.border,
                                borderLeftWidth: 3,
                                borderLeftColor: getLineColor(routeCandidate?.rawItems?.[routeCandidate.rawItems.length - 1]?.lineNm),
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                marginLeft: 6,
                                overflow: 'hidden',
                            }}>
                                {(() => {
                                    const rawItems = routeCandidate?.rawItems || [];
                                    const lineNm = rawItems[rawItems.length - 1]?.lineNm;
                                    return lineNm ? (
                                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: getLineColor(lineNm), alignItems: 'center', justifyContent: 'center', marginRight: 6, flexShrink: 0 }}>
                                            <Text style={{ color: '#fff', fontSize: 11, fontFamily: 'Nunito-Bold' }}>{getLineBadgeLabel(lineNm)}</Text>
                                        </View>
                                    ) : null;
                                })()}
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={{ fontSize: 13, fontFamily: 'Nunito-Bold', color: C.textHigh, flexShrink: 1 }} numberOfLines={1}>
                                        {destination?.name ?? '—'}
                                    </Text>
                                    <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: C.textMid, marginTop: 1 }} numberOfLines={1}>
                                        {destination?.ko ? (destination.ko.endsWith('역') ? destination.ko : destination.ko + '역') : ''}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <ResultView
                        from={origin}
                        to={destination}
                        onReSearch={() => {
                            setView('idle');
                            setRouteData(null);
                        }}
                        routeData={routeData}
                        isLoading={isLoading}
                        loadingStep={loadingStep}
                        stationNameMap={stationNameMap}
                        lineMismatchNotice={lineMismatchNotice}
                        errorType={routeError}
                        originExits={originExits}
                        destExits={destExits}
                        selectedOriginExit={currentOriginExit}
                        selectedDestExit={currentDestExit}
                        onChangeOriginExit={handleChangeOriginExit}
                        onChangeDestExit={handleChangeDestExit}
                        exitStatuses={exitStatuses}
                        isPartialLoading={isPartialLoading}
                    />
                </View>
            ) : (
                <View style={{ flex: 1 }}>

                    {/* ── Slim Header ── */}
                    <View style={{
                        paddingTop: Math.max(insets.top, 10) + 14,
                        paddingBottom: 12,
                        paddingHorizontal: 20,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottomWidth: 1,
                        borderBottomColor: C.border,
                        backgroundColor: C.bg,
                    }}>
                        <Image
                            source={require('../../assets/icon.png')}
                            style={{ width: 40, height: 40, borderRadius: 8, marginRight: 12 }}
                            resizeMode="contain"
                        />
                        <View>
                            <Text style={{ fontSize: 19, fontFamily: 'Nunito-ExtraBold', color: C.textHigh, letterSpacing: -0.3 }}>
                                <Text style={{ color: C.primary }}>S</Text>
                                <Text>tep-Free </Text>
                                <Text style={{ color: C.primary }}>S</Text>
                                <Text>eoul </Text>
                                <Text style={{ color: C.primary }}>S</Text>
                                <Text>ubway</Text>
                            </Text>
                            <Text style={{ fontSize: 11, fontFamily: 'Pretendard-Regular', color: C.textLow, marginTop: 2 }}>
                                서울 지하철: 계단 없이 엘리베이터로 이동하세요.
                            </Text>
                        </View>
                    </View>

                    <ScrollView
                        style={{ flex: 1 }}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={{
                            paddingTop: 28,
                            paddingHorizontal: 20,
                            paddingBottom: 80,
                        }}
                    >
                        {/* ── Value Proposition ── */}
                        <Text style={{
                            fontSize: 12,
                            fontFamily: 'Nunito-Bold',
                            color: C.textMid,
                            textAlign: 'center',
                            marginBottom: 12,
                            letterSpacing: 0.3,
                            fontStyle: 'italic',
                        }}>
                            Beyond Subway Lines, We Guide Your Every Step.
                        </Text>
                        <View style={{
                            flexDirection: 'row',
                            justifyContent: 'center',
                            marginBottom: 24,
                        }}>
                            {[
                                {
                                    Icon: ArrowUpDown,
                                    label: 'Exit-to-Exit',
                                    labelKo: '지하철 입구에서 출구까지',
                                },
                                {
                                    Icon: Luggage,
                                    label: 'Luggage Friendly',
                                    labelKo: '캐리어 이동 최적화',
                                },
                                {
                                    Icon: Map,
                                    label: 'In-Station Path',
                                    labelKo: '상세 역내 동선',
                                },
                            ].map(({ Icon, label, labelKo }, idx, arr) => (
                                <React.Fragment key={label}>
                                    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                                        <Icon size={22} color="#8A9CA3" strokeWidth={2} />
                                        <Text style={{
                                            fontSize: 11,
                                            fontFamily: 'Nunito-ExtraBold',
                                            color: C.textMid,
                                            textAlign: 'center',
                                            lineHeight: 14,
                                        }}>
                                            {label}
                                        </Text>
                                        <Text style={{
                                            fontSize: 9,
                                            fontFamily: 'Pretendard-Regular',
                                            color: '#AAABB8',
                                            textAlign: 'center',
                                            lineHeight: 12,
                                        }}>
                                            {labelKo}
                                        </Text>
                                    </View>
                                    {idx < arr.length - 1 && (
                                        <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 8, alignSelf: 'stretch' }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </View>

                        {/* ── Search area ── */}
                        <View style={{ flexDirection: 'row', alignItems: 'stretch', marginBottom: 16 }}>
                            <View style={{
                                flex: 1,
                                borderRadius: 14,
                                elevation: 4,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.08,
                                shadowRadius: 12,
                                backgroundColor: C.surface,
                            }}>
                                <View style={{
                                    borderRadius: 14,
                                    borderWidth: 1,
                                    borderColor: C.border,
                                    overflow: 'hidden',
                                }}>
                                    <SearchRow type="origin" />
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 42, alignItems: 'center' }}>
                                            {[0, 1, 2].map(i => (
                                                <View key={i} style={{ width: 2, height: 3, borderRadius: 1, backgroundColor: C.primary + '50', marginVertical: 1 }} />
                                            ))}
                                        </View>
                                        <View style={{ flex: 1, height: 1, backgroundColor: C.border }} />
                                        <TouchableOpacity
                                            onPress={handleSwap}
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            style={{ paddingHorizontal: 14, paddingVertical: 4 }}
                                        >
                                            <MaterialCommunityIcons name="swap-vertical" size={18} color={C.primary} />
                                        </TouchableOpacity>
                                    </View>
                                    <SearchRow type="destination" />
                                </View>
                            </View>
                        </View>

                        {/* ── Find Route button ── */}
                        {(() => {
                            const isReady = !!(origin && destination);
                            return (
                                <TouchableOpacity
                                    onPress={handleFindRoute}
                                    disabled={!isReady}
                                    activeOpacity={isReady ? 0.8 : 1}
                                    style={{
                                        backgroundColor: isReady ? C.primary : '#E0E0E8',
                                        borderRadius: 14,
                                        paddingVertical: 16,
                                        alignItems: 'center',
                                        marginBottom: 16,
                                        elevation: isReady ? 6 : 0,
                                        shadowColor: isReady ? C.primary : 'transparent',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: isReady ? 0.35 : 0,
                                        shadowRadius: 10,
                                    }}
                                >
                                    <Text style={{ fontSize: 16, fontFamily: 'Nunito-ExtraBold', color: isReady ? '#fff' : C.textMuted }}>
                                        Find Step-Free Route
                                    </Text>
                                    <Text style={{ fontSize: 11, fontFamily: 'Pretendard-Regular', marginTop: 2, color: isReady ? 'rgba(255,255,255,0.75)' : C.textMuted }}>
                                        계단 없는 경로 찾기
                                    </Text>
                                </TouchableOpacity>
                            );
                        })()}

                    </ScrollView>

                    {/* ── Coverage — fixed bottom ── */}
                    <View style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        backgroundColor: C.bg,
                        borderTopWidth: 1, borderTopColor: C.border,
                        paddingVertical: 12,
                        alignItems: 'center',
                    }}>
                        <Text style={{
                            fontSize: 9, fontFamily: 'Nunito-Bold', color: C.textMid,
                            marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase',
                        }}>
                            Service Coverage Lines
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 'A'].map((l) => (
                                <View key={l} style={{
                                    backgroundColor: LINE_COLORS[String(l)],
                                    width: 16, height: 16, borderRadius: 8,
                                    alignItems: 'center', justifyContent: 'center',
                                    marginRight: 3,
                                }}>
                                    <Text style={{ color: '#fff', fontSize: 8, fontFamily: 'Nunito-Bold' }}>{l}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={{ fontSize: 9, fontFamily: 'Nunito-Regular', color: C.textLow }}>
                            Data: KRIC · Public Data Portal · Seoul Metro
                        </Text>
                    </View>
                </View>
            )}

            {/* ── 역 검색 오버레이 ── */}
            {searchType && (
                <View style={{
                    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
                    zIndex: 50, backgroundColor: 'rgba(0,0,0,0.55)',
                }}>
                    <SearchingView
                        onClose={() => setSearchType(null)}
                        onSelect={handleSelectStation}
                        placeholder={searchType === 'origin' ? 'Starting Station 출발역' : 'Arrival Station 도착역'}
                        autoFocusInput
                        showNearby={searchType === 'origin'}
                    />
                </View>
            )}

        </View>
    );
}
