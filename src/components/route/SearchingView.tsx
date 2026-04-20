import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Image } from 'react-native';
import * as Location from 'expo-location';
import { LINE_COLORS } from '../../constants/data';
import { ExitBadge } from '../common/ExitBadge';
import LineBadge from '../common/LineBadge';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

import { matchesChosung } from '../../utils/chosung';

type Station = any; // Will represent a single station without exit

interface SearchingViewProps {
    onClose: () => void;
    onSelect: (station: Station, exit: any) => void;
    placeholder?: string;
    autoFocusInput?: boolean;
    showNearby?: boolean;
}

const SafeView: any = View;
const SafeText: any = Text;
const SafeTouchableOpacity: any = TouchableOpacity;
const SafeTextInput: any = TextInput;
const SafeScrollView: any = ScrollView;

export function SearchingView({ onClose, onSelect, placeholder, autoFocusInput, showNearby }: SearchingViewProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [allStations, setAllStations] = useState<any[]>([]);
    const [gpsLoading, setGpsLoading] = useState(false);
    const [gpsError, setGpsError] = useState<string | null>(null);
    const inputRef = useRef<TextInput>(null);

    const handleFindNearby = async () => {
        setGpsLoading(true);
        setGpsError(null);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setGpsError('Location permission denied. Please type the station name directly.');
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = pos.coords;

            const { data: stations } = await supabase
                .from('stations')
                .select('id, name_ko, name_en, line, stin_cd, latitude, longitude');

            const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
                const R = 6371000;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat / 2) ** 2 +
                    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            };

            const nearby = (stations || [])
                .filter((s: any) => s.latitude && s.longitude && LINE_COLORS[String(s.line)] !== undefined)
                .map((s: any) => ({ ...s, dist: haversine(latitude, longitude, s.latitude, s.longitude) }))
                .filter((s: any) => s.dist <= 1000)
                .sort((a: any, b: any) => a.dist - b.dist);

            if (nearby.length === 0) {
                setGpsError('No step-free station found within 1km.\nPlease type the station name directly.');
                return;
            }

            const nearest = nearby[0];

            // 같은 역명의 모든 호선 수집
            const allLines = (stations || [])
                .filter((s: any) => s.name_ko === nearest.name_ko && LINE_COLORS[String(s.line)] !== undefined)
                .map((s: any) => s.line)
                .sort((a: any, b: any) => {
                    const n = (x: any) => { const v = parseInt(String(x), 10); return isNaN(v) ? 999 : v; };
                    return n(a) - n(b);
                });

            onSelect(
                { id: nearest.id, name: nearest.name_en, ko: nearest.name_ko, lines: allLines, stin_cd: nearest.stin_cd },
                null
            );
        } catch (_) {
            setGpsError('Could not get location. Please type the station name directly.');
        } finally {
            setGpsLoading(false);
        }
    };

    // 1. Fetch all stations once on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            if (autoFocusInput !== false) {
                inputRef.current?.focus();
            }
        }, 150);

        setLoading(true);
        const loadAllData = async () => {
            setLoading(true);
            try {
                const { data: stData, error: stError } = await supabase
                    .from('stations')
                    .select('id, name_ko, name_en, line, stin_cd');

                if (stError) throw stError;

                // 역명 기준으로 그룹핑 — 같은 역의 다른 호선을 하나로 묶음
                const groupMap = new Map<string, any>();
                const lineOrder = (x: any) => { const v = parseInt(String(x), 10); return isNaN(v) ? 999 : v; };
                (stData || [])
                    .filter((s: any) => LINE_COLORS[String(s.line)] !== undefined)
                    .sort((a: any, b: any) => lineOrder(a.line) - lineOrder(b.line))
                    .forEach((s: any) => {
                        const key = s.name_ko;
                        if (!groupMap.has(key)) {
                            groupMap.set(key, {
                                id: s.id,
                                name: s.name_en,
                                ko: s.name_ko,
                                lines: [s.line],
                                stin_cd: s.stin_cd,
                            });
                        } else {
                            const g = groupMap.get(key);
                            if (!g.lines.includes(s.line)) g.lines.push(s.line);
                        }
                    });

                const processed = Array.from(groupMap.values()).map((g: any) => ({
                    ...g,
                    lines: g.lines.sort((a: any, b: any) => {
                        return lineOrder(a) - lineOrder(b);
                    }),
                }));
                setAllStations(processed);
            } catch (err) {
                console.error('[SearchingView] Load failed:', err);
            } finally {
                setLoading(false);
            }
        };

        loadAllData();

        return () => clearTimeout(timer);
    }, []);

    // 2. Filter locally when query changes
    useEffect(() => {
        if (query.trim().length < 1) {
            setResults([]);
            return;
        }

        const rawQ = query.trim();
        const q = rawQ.toLowerCase().replace(/역$/, '');
        const filtered = allStations.filter((s: any) =>
            matchesChosung(q, s.ko) ||
            (s.name && s.name.toLowerCase().includes(q))
        );

        const matchScore = (s: any): number => {
            const ko = s.ko || '';
            const en = (s.name || '').toLowerCase();
            if (ko === q || ko === rawQ) return 0;
            if (ko.startsWith(q)) return 1;
            if (en === q) return 2;
            if (en.startsWith(q)) return 3;
            return 4;
        };

        filtered.sort((a: any, b: any) => {
            const scoreDiff = matchScore(a) - matchScore(b);
            if (scoreDiff !== 0) return scoreDiff;
            return (a.ko || '').localeCompare(b.ko || '', 'ko');
        });

        setResults(filtered.slice(0, 20));
    }, [query, allStations]);

    const handleSelectStation = (station: any) => {
        onSelect(station, null);
    };

    return (
        <SafeView style={{ flex: 1, width: '100%', height: '100%' }}>
            <SafeTouchableOpacity
                activeOpacity={1}
                onPress={onClose}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
            />

            <SafeView style={{ flex: 1, width: '100%', marginTop: 40, backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden' }}>
                {/* Branding */}
                <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderBottomWidth: 1, borderBottomColor: '#E8E8EE' }}>
                    <View style={{ marginRight: 12 }}>
                        <Image
                            source={require('../../../assets/icon.png')}
                            style={{ width: 40, height: 40, borderRadius: 8 }}
                            resizeMode="contain"
                        />
                    </View>
                    <View>
                        <SafeText style={{ color: '#18181B', fontSize: 12, fontWeight: '800', letterSpacing: -0.2 }}>
                            <SafeText style={{ color: '#C8362A' }}>S</SafeText>
                            {'tep-Free '}
                            <SafeText style={{ color: '#C8362A' }}>S</SafeText>
                            {'eoul '}
                            <SafeText style={{ color: '#C8362A' }}>S</SafeText>
                            {'ubway'}
                        </SafeText>
                        <SafeText style={{ color: '#8A9CA3', fontSize: 9, fontWeight: '500', marginTop: 1 }}>서울 지하철: 계단 없이 엘리베이터로 이동하세요.</SafeText>
                    </View>
                </View>

                {/* Search input */}
                <SafeView style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E8E8EE' }}>
                    <SafeView style={{ 
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        backgroundColor: '#EEEEF3', 
                        borderRadius: 16, 
                        paddingHorizontal: 16, 
                        height: 56, 
                        borderWidth: 1, 
                        borderColor: '#E8E8EE',
                        // Design Guide: box-shadow: 0px 4px 12px rgba(0, 0, 0, 0.08)
                        elevation: 4,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.08,
                        shadowRadius: 12,
                    }}>
                        <MaterialCommunityIcons name="magnify" size={24} color="#8A9CA3" style={{ marginRight: 10 }} />
                        <SafeView style={{ flex: 1, justifyContent: 'center' }}>
                            <SafeTextInput
                                ref={inputRef}
                                value={query}
                                onChangeText={setQuery}
                                placeholder=""
                                style={{ fontSize: 18, fontWeight: '700', color: '#111116', padding: 0 }}
                                autoFocus={true}
                            />
                            {query.length === 0 && (() => {
                                const ph = placeholder || 'Station Name 역 이름';
                                const match = ph.match(/^([A-Za-z\s]+?)\s+([^\x00-\x7F].+)$/);
                                const engPart = match ? match[1] : ph;
                                const korPart = match ? match[2] : '';
                                return (
                                    <SafeView style={{ position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'baseline' }} pointerEvents="none">
                                        <SafeText style={{ fontSize: 18, color: '#8A9CA3', fontFamily: 'Nunito-Bold' }}>{engPart}</SafeText>
                                        {korPart ? <SafeText style={{ fontSize: 13, color: '#8A9CA3', marginLeft: 6, fontFamily: 'Pretendard-Regular' }}>{korPart}</SafeText> : null}
                                    </SafeView>
                                );
                            })()}
                        </SafeView>
                        {query.length > 0 ? (
                            <SafeTouchableOpacity onPress={() => setQuery('')} style={{ padding: 8 }}>
                                <SafeText style={{ color: '#52525B', fontSize: 18 }}>✕</SafeText>
                            </SafeTouchableOpacity>
                        ) : (
                            <SafeTouchableOpacity onPress={onClose} style={{ padding: 8 }}>
                                <SafeText style={{ color: '#52525B', fontWeight: '700', fontSize: 14 }}>Cancel</SafeText>
                            </SafeTouchableOpacity>
                        )}
                    </SafeView>
                </SafeView>

                {/* Results */}
                <SafeScrollView
                    style={{ flex: 1 }}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 120, flexGrow: 1 }}
                >
                    {query.length === 0 ? (
                        <SafeView>
                            {/* Find Nearby Station */}
                            {showNearby && (
                                <SafeTouchableOpacity
                                    onPress={handleFindNearby}
                                    disabled={gpsLoading}
                                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#E8E8EE', backgroundColor: '#FFF8F7' }}
                                >
                                    {gpsLoading
                                        ? <ActivityIndicator size="small" color="#C8362A" style={{ marginRight: 16 }} />
                                        : <MaterialCommunityIcons name="map-marker" size={22} color="#C8362A" style={{ marginRight: 16 }} />
                                    }
                                    <SafeView style={{ flex: 1 }}>
                                        <SafeText style={{ fontSize: 16, fontWeight: '700', color: '#C8362A' }}>
                                            {gpsLoading ? 'Searching nearby...' : 'Find Nearby Station · within 1 km'}
                                        </SafeText>
                                        <SafeText style={{ fontSize: 11, color: '#52525B', marginTop: 2 }}>
                                            {gpsLoading ? '주변 역 탐색 중...' : '주변 역 찾기 · 1km 이내'}
                                        </SafeText>
                                        {gpsError && (
                                            <SafeText style={{ fontSize: 11, color: '#C8362A', marginTop: 4, lineHeight: 16 }}>
                                                ⚠ {gpsError}
                                            </SafeText>
                                        )}
                                    </SafeView>
                                </SafeTouchableOpacity>
                            )}
                            <SafeView style={{ paddingVertical: 40 }} />
                        </SafeView>
                    ) : loading ? (
                        <SafeView style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#C8362A" />
                        </SafeView>
                    ) : results.length === 0 ? (
                        <SafeView style={{ paddingVertical: 40, alignItems: 'center' }}>
                            <SafeText style={{ fontSize: 14, color: '#52525B' }}>No results found · 검색 결과가 없습니다</SafeText>
                        </SafeView>
                    ) : (
                        <SafeView style={{ paddingHorizontal: 8 }}>
                            {results.map((st: any) => (
                                <SafeTouchableOpacity
                                    key={`${st.id}`}
                                    onPress={() => handleSelectStation(st)}
                                    style={{ width: '100%', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: '#E8E8EE' }}
                                >
                                    <SafeView style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <SafeText numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 20, fontWeight: '700', color: '#18181B' }}>
                                                {st.name}
                                            </SafeText>
                                            <SafeText style={{ fontSize: 14, color: '#52525B', marginTop: 2 }}>
                                                {st.ko ? (st.ko.endsWith('역') ? st.ko : st.ko + '역') : ''}
                                            </SafeText>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 4, marginLeft: 8 }}>
                                            {(st.lines || [st.line]).map((l: any) => (
                                                <LineBadge key={l} line={l} color={LINE_COLORS[String(l)]} size={24} />
                                            ))}
                                        </View>
                                    </SafeView>
                                </SafeTouchableOpacity>
                            ))}
                        </SafeView>
                    )}

                    {/* Footer */}
                    <View style={{ marginTop: 32, marginBottom: 40, alignItems: 'center' }}>
                        <Text style={{ fontSize: 8, fontWeight: '700', color: '#52525B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Coverage · 지원 노선</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginBottom: 8 }}>
                            {([1, 2, 3, 4, 5, 6, 7, 8, 9, 'A']).map((l) => (
                                <View key={l} style={{ backgroundColor: LINE_COLORS[String(l)], width: 14, height: 14, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ color: '#fff', fontWeight: '700', fontSize: 8 }}>{l}</Text>
                                </View>
                            ))}
                        </View>
                        <Text style={{ fontSize: 8, color: '#AAABB8', fontWeight: '500' }}>
                            Data: KRIC · data.go.kr · Seoul Metro Open API
                        </Text>
                    </View>
                </SafeScrollView>
            </SafeView>
        </SafeView>
    );
}
