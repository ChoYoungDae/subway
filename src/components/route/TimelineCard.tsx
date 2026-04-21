import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { ImageZoomModal } from '../common/ImageZoomModal';
import { getLineColor, getLineBadgeLabel } from '../../utils/lineColors';
import { ExitBadge } from '../common/ExitBadge';
import LineBadge from "../common/LineBadge";
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FeedbackService } from '../../services/FeedbackService';

type ViewMode = 'summary' | 'detail';

interface StepTranslation {
    order?: number;
    short?:  { en: string; ko: string };
    detail?: { en: string; ko: string };
    en?: string;
    ko?: string;
    floor_from?: string | null;
    floor_to?:   string | null;
    type: 'elevator' | 'move' | 'gate' | 'board' | 'alight';
    exit_no?: string | null;
    car_position?: string | null;
    car_position_uncertain?: boolean;
}

interface TimelineCardProps {
    segment: {
        station: any;
        transfer?: boolean;
        fromLine?: string | null;
        toLine?: string | null;
        steps: StepTranslation[];
        isRide?: boolean;
        imgPaths?: string[];
        isDestination?: boolean;
        elevatorStatuses?: any[];
        exitFallback?: boolean;
    };
    viewMode: ViewMode;
    stationNameMap?: Record<string, string>;
    hideImages?: boolean;
    routeKey?: string;
    segmentIndex?: number;
    hashKey?: string | null;
}

const CARD_IMAGE_ASPECT = 1.65; // 16:10 ─ floor plans tend to be landscape

/** 
 * 지하는 F를 떼고 (B1F -> B1), 지상은 F를 유지 (2F)하는 규칙 적용.
 */
function formatFloor(f: string | null | undefined): string | null {
    if (!f) return null;
    const s = f.replace(/^B(\d+)F$/i, 'B$1');  // B1F → B1
    if (/^\d+$/.test(s)) return `${s}F`;        // "1" → "1F"
    return s;
}

/** 
 * 문장 끝의 괄호 표기 "(...)"를 문장 맨 앞으로 이동.
 * 마침표(.)나 공백이 뒤에 붙어 있어도 처리 가능하도록 개선.
 */
/**
 * (prefix) rest 형태의 문자열을 prefix와 rest로 분리.
 * 괄호 없이 파란색 렌더링에 사용.
 */
function parseStepText(text: string): { prefix: string | null; rest: string } {
    if (!text) return { prefix: null, rest: '' };
    const match = text.match(/^\(([^)]+)\)\s*([\s\S]*)$/);
    if (match) return { prefix: match[1], rest: match[2] };
    return { prefix: null, rest: text };
}

function moveTrailingParen(text: string, floorLabel?: string | null): string {
    if (!text) return '';
    
    // Client-side cleanup of English technical terms in Korean text (Safety net)
    let shifted = text;
    if (/[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(text)) {
        shifted = text.replace(/방면(\d)/g, '방면 $1')
                      .replace(/Station Hall|Concourse/gi, '대합실')
                      .replace(/Ground Level/gi, '지상층')
                      .replace(/개집표기|개표기\/집표기/gi, '개찰구')
                      .replace(/Regular Train Platform/gi, '일반열차 승강장')
                      .replace(/Platform/gi, '승강장')
                      .replace(/Ticket Gate/gi, '개찰구')
                      .replace(/Elevator/gi, '엘리베이터')
                      .replace(/Transfer/gi, '환승')
                      .replace(/Car (\d+)/gi, '$1번 칸');
    }

    if (floorLabel) {
        // floorLabel이 있으면: 텍스트 내 floor paren을 모두 제거 후 앞에 붙임
        // (AI가 문장 중간/끝에 층 정보를 삽입하는 경우 대응)
        const stripped = shifted
            .replace(/\(B?\d+F?\s*(?:→\s*B?\d+F?)?\)/g, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        return `(${floorLabel}) ${stripped}`;
    }

    const match = shifted.match(/^(.*\S)\s*(\([^)]+\))[\s.]*$/);
    if (match) {
        const body = match[1].replace(/[.,]$/, '').trim();
        shifted = `${formatFloor(match[2])} ${body}`;
    }

    return shifted;
}

function getElevatorStatusColor(step: StepTranslation, statuses: any[]): string | null {
    if (!statuses || statuses.length === 0) return null;
    if (step.type !== 'elevator') return null;

    // 1. Match by exit_no (Enriched by RouteAssembler) - Most reliable
    if (step.exit_no) {
        const matching = statuses.find(s => {
            const vcnt = s.vcntEntrcNo || '';
            return vcnt.includes(String(step.exit_no));
        });
        if (matching) return matching.oprtngSitu === 'M' ? '#2E7D32' : '#C62828';
    }

    // 2. Fallback: Match by text in detail or short ko
    const stepKo = step.detail?.ko || step.short?.ko || '';
    const matching = statuses.find(s => {
        const vcnt = s.vcntEntrcNo || '';
        const exitMatch = stepKo.match(/(\d+)번\s*(?:출구|출입구)/);
        if (exitMatch && vcnt.includes(exitMatch[1])) return true;
        if (stepKo.includes('외부') && vcnt.trim().length > 0) return true;
        return false;
    });

    if (!matching) return null;
    return matching.oprtngSitu === 'M' ? '#2E7D32' : '#C62828';
}

const DottedLine = ({ style }: { style?: any }) => {
    const [height, setHeight] = useState(0);
    const dotSize = 2;
    const gap = 3.5; // Fixed gap distance (tuned for step 3-4 style)
    const dotCount = height > 0 ? Math.floor(height / (dotSize + gap)) : 5;

    return (
        <View
            style={[{ flex: 1, width: 2, alignItems: 'center', justifyContent: 'center' }, style]}
            onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
        >
            {Array.from({ length: dotCount }).map((_, i) => (
                <View
                    key={i}
                    style={{
                        width: dotSize,
                        height: dotSize,
                        borderRadius: dotSize / 2,
                        backgroundColor: '#AAABB8',
                        marginBottom: i === dotCount - 1 ? 0 : gap,
                    }}
                />
            ))}
        </View>
    );
};

export function TimelineCard({ segment, viewMode, stationNameMap = {}, hideImages = false, routeKey, segmentIndex, hashKey }: TimelineCardProps) {
    // All hooks must come before any conditional return
    const activeImgIdx = 0;
    const [mapExpanded, setMapExpanded] = useState(false);
    const [zoomUri, setZoomUri] = useState<string | null>(null);
    const [userFeedback, setUserFeedback] = useState<'like' | 'dislike' | null>(null);

    const handleFeedback = async (type: 'like' | 'dislike') => {
        if (userFeedback) return; // Prevent multiple submissions
        setUserFeedback(type);
        const res = await FeedbackService.submitFeedback(routeKey, segmentIndex, type, hashKey);
        if (res.error) {
            // Optionally handle error, e.g., revert userFeedback state or show a toast
            console.error("Feedback submission failed:", res.error);
            setUserFeedback(null); // Revert state on error
        }
    };

    const { station, transfer, fromLine, toLine, steps, isRide, imgPaths, isDestination, elevatorStatuses = [], exitFallback = false } = segment;
    const lineColor = getLineColor(station.line);
    const hasImages = Array.isArray(imgPaths) && imgPaths.length > 0;

    // ── Subway ride card ──────────────────────────────────────────────────────
    if (isRide) {
        const intermediateStations = station.intermediateStations || [];
        return (
            <View style={{
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: '#FFFFFF',
                borderTopWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5,
                borderLeftWidth: 3,
                borderTopColor: '#E8E8EE', borderRightColor: '#E8E8EE', borderBottomColor: '#E8E8EE',
                borderLeftColor: lineColor,
                flexDirection: 'row', alignItems: 'center',
                paddingHorizontal: 12, paddingVertical: 8,
            }}>
                <View className="flex-row items-start flex-1">
                    <View className="pt-0.5">
                        <LineBadge line={station.line} color={lineColor} size={22} />
                    </View>
                    <View className="flex-1 ml-3">
                        <Text style={{ fontSize: 13.5, fontFamily: 'Nunito-Bold', color: '#111116' }}>{steps[0]?.en}</Text>
                        <Text style={{ fontSize: 10.5, fontFamily: 'Pretendard-Regular', color: '#71717A', marginTop: 1 }}>{steps[0]?.ko}</Text>
                        {intermediateStations.length > 0 && (
                            <View className="mt-1 flex-row flex-wrap">
                                <Text style={{ fontSize: 10, fontFamily: 'Nunito-Regular', color: '#8E8E93' }} numberOfLines={2}>
                                    {intermediateStations.map((st: string) => {
                                        const en = stationNameMap[st] || st;
                                        return `${en} (${st})`;
                                    }).join(', ')}
                                </Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    // ── Station access / transfer card ────────────────────────────────────────
    return (
        <View style={{
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5,
            borderLeftWidth: 3,
            borderTopColor: '#E8E8EE', borderRightColor: '#E8E8EE', borderBottomColor: '#E8E8EE',
            borderLeftColor: lineColor,
        }}>
            {/* Card header */}
            <View className="flex-row items-start px-3 py-2.5 border-b border-[#E8E8EE]">
                <View className="pt-1">
                    <LineBadge line={station.line} color={lineColor} size={24} />
                </View>
                <View className="flex-1 ml-3">
                    <View className="flex-row items-center justify-between">
                        <View className="flex-row items-center flex-wrap flex-1">
                            <Text style={{ fontSize: 20, fontFamily: 'Nunito-Bold', color: '#111116', marginRight: 8 }} numberOfLines={1}>{station.name}</Text>
                            {transfer && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                                    <View className="bg-[#2E5E4A] px-1.5 py-0.5 rounded">
                                        <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: '#fff' }}>Transfer · 환승</Text>
                                    </View>
                                    {toLine && (
                                        <View style={{ marginLeft: 6 }}>
                                            <LineBadge line={toLine} size={24} />
                                        </View>
                                    )}
                                </View>
                            )}
                            {station.exit && station.exit !== 'NONE' ? <ExitBadge num={station.exit} size="sm" /> : null}
                        </View>
                        
                        {/* Detail mode: map toggle button (Second position) */}
                        {viewMode === 'detail' && hasImages && (
                            <TouchableOpacity
                                onPress={() => setMapExpanded(v => !v)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={{ marginLeft: 8 }}
                            >
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
                                    backgroundColor: mapExpanded ? '#C8362A' : '#F0F0F5',
                                }}>
                                    <MaterialIcons 
                                        name="map" 
                                        size={11} 
                                        color={mapExpanded ? '#FFFFFF' : '#555568'} 
                                        style={{ marginRight: 4 }}
                                    />
                                    <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: mapExpanded ? '#FFFFFF' : '#555568' }}>
                                        Visual Guide
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View className="flex-row items-center justify-between mt-0.5">
                        <Text style={{ fontSize: 14, fontFamily: 'Pretendard-Regular', color: '#71717A' }}>{station.ko ? (station.ko.endsWith('역') ? station.ko : station.ko + '역') : ''}</Text>
                    </View>
                </View>
            </View>

            {/* ── [Summary mode] Large image ── */}
            {!hideImages && viewMode === 'summary' && hasImages && (
                <>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setZoomUri(imgPaths[activeImgIdx])}
                        style={{ width: '100%', aspectRatio: CARD_IMAGE_ASPECT, backgroundColor: '#FFFFFF' }}
                    >
                        <Image
                            source={{ uri: imgPaths[activeImgIdx] }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center', paddingTop: 1, paddingBottom: 6, backgroundColor: '#FFFFFF' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Nunito-Regular', color: '#AAABB8' }}>
                            Tap to enlarge map
                        </Text>
                    </View>
                    {isDestination && (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F0F7F4', borderTopWidth: 1, borderTopColor: 'rgba(46,94,74,0.15)' }}>
                            <Text style={{ fontSize: 10, color: '#2E5E4A', marginRight: 4 }}>ℹ️</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Nunito-Regular', color: '#2E5E4A', lineHeight: 14 }}>
                                    Numbers are shown in reverse for arrival.
                                </Text>
                                <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: '#2E5E4A', lineHeight: 14 }}>
                                    도착 안내를 위해 지도 번호를 역순으로 안내합니다.
                                </Text>
                            </View>
                        </View>
                    )}
                </>
            )}

            {/* ── [Detail mode] Expanded map (toggle) ── */}
            {!hideImages && viewMode === 'detail' && hasImages && mapExpanded && (
                <>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setZoomUri(imgPaths[activeImgIdx])}
                        style={{ width: '100%', aspectRatio: CARD_IMAGE_ASPECT, backgroundColor: '#F0F0F5' }}
                    >
                        <Image
                            source={{ uri: imgPaths[activeImgIdx] }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="contain"
                        />
                    </TouchableOpacity>
                    <View style={{ alignItems: 'center', paddingTop: 1, paddingBottom: 6, backgroundColor: '#F0F0F5' }}>
                        <Text style={{ fontSize: 10, fontFamily: 'Nunito-Regular', color: '#AAABB8' }}>
                            Tap to enlarge map
                        </Text>
                    </View>
                    {isDestination && (
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F0F7F4', borderTopWidth: 1, borderTopColor: 'rgba(46,94,74,0.15)' }}>
                            <Text style={{ fontSize: 10, color: '#2E5E4A', marginRight: 4 }}>ℹ️</Text>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 10, fontFamily: 'Nunito-Regular', color: '#2E5E4A', lineHeight: 14 }}>
                                    Numbers are shown in reverse for arrival.
                                </Text>
                                <Text style={{ fontSize: 10, fontFamily: 'Pretendard-Regular', color: '#2E5E4A', lineHeight: 14 }}>
                                    도착 안내를 위해 지도 번호를 역순으로 안내합니다.
                                </Text>
                            </View>
                        </View>
                    )}
                </>
            )}

            {/* Zoom modal */}
            {zoomUri !== null && (
                <ImageZoomModal
                    visible={true}
                    uri={zoomUri}
                    onClose={() => setZoomUri(null)}
                />
            )}

            {/* Step timeline */}
            <View style={{ backgroundColor: '#FFFFFF', paddingLeft: 16, paddingRight: 12, paddingTop: viewMode === 'summary' ? 6 : 12, paddingBottom: viewMode === 'summary' ? 6 : 8 }}>
                {steps.length === 0 ? (
                    <View style={{ paddingVertical: 8, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, fontFamily: 'Nunito-Regular', color: '#AAABB8' }}>No guidance available</Text>
                    </View>
                ) : steps.map((step: StepTranslation, i: number) => {
                    // Destination steps already arrive pre-ordered in reverse by AI
                    const stepNum = step.order;
                    const floorLabel = step.floor_from && step.floor_to
                        ? step.floor_from === step.floor_to
                            ? formatFloor(step.floor_from)
                            : `${formatFloor(step.floor_from)} → ${formatFloor(step.floor_to)}`
                        : formatFloor(step.floor_from ?? step.floor_to ?? null);

                    const isLastStep = i === steps.length - 1;
                    const spacing = viewMode === 'summary' ? 4 : 12;
                    const circleShift = viewMode === 'summary' ? 0 : 2.5;

                    return (
                        <View key={i} style={{ flexDirection: 'row', alignItems: 'stretch' }}>
                            {/* Step number + connector line */}
                            <View style={{ width: 24, alignItems: 'center', marginRight: 10 }}>
                                <View style={{ height: 2.5 + circleShift }} />
                                <View style={{
                                    width: 20, height: 20, borderRadius: 10,
                                    borderWidth: 1.5, borderColor: '#C8362A',
                                    alignItems: 'center', justifyContent: 'center',
                                    backgroundColor: '#FFF5F4',
                                    zIndex: 2,
                                }}>
                                    <Text style={{ fontSize: 10, fontFamily: 'Nunito-Bold', color: '#C8362A', includeFontPadding: false }}>
                                        {stepNum}
                                    </Text>
                                </View>
                                {!isLastStep && (
                                    <View style={{ flex: 1, alignItems: 'center' }}>
                                        <View style={{ height: viewMode === 'summary' ? 4 : 5 }} />
                                        <DottedLine 
                                            key={viewMode}
                                            style={{ flex: 1 }} 
                                        />
                                        <View style={{ height: viewMode === 'summary' ? 4 : 5 }} />
                                    </View>
                                )}
                            </View>

                            {/* Text area */}
                             <View style={{ 
                                 flexGrow: 1, 
                                 flexShrink: 1,
                                 paddingTop: viewMode === 'summary' ? 2 : 4, 
                                 paddingBottom: isLastStep ? 0 : spacing,
                                 paddingRight: step.car_position ? 56 : 20 
                             }}>
                                {viewMode === 'summary' ? (
                                    <>
                                        {(() => {
                                            const { prefix: enPre, rest: enRest } = parseStepText(moveTrailingParen(step.short?.en ?? '', floorLabel));
                                            const { rest: koRest } = parseStepText(moveTrailingParen(step.short?.ko ?? '', floorLabel));
                                            return (
                                                <>
                                                    <Text style={{ fontSize: 12, fontFamily: 'Nunito-SemiBold', color: '#111116', lineHeight: 16 }}>
                                                        {enPre ? <Text style={{ color: '#0090D2' }}>{enPre}{'  '}</Text> : null}{enRest}
                                                    </Text>
                                                    {step.short?.ko ? (
                                                        <Text style={{ fontSize: 10.5, fontFamily: 'Pretendard-Regular', color: '#8E8E93', lineHeight: 14, marginTop: 1 }}>
                                                            {koRest}
                                                        </Text>
                                                    ) : null}
                                                </>
                                            );
                                        })()}
                                    </>
                                ) : (
                                    <>
                                        {(() => {
                                            const { prefix: enPre, rest: enRest } = parseStepText(moveTrailingParen(step.detail?.en ?? '', floorLabel));
                                            const { rest: koRest } = parseStepText(moveTrailingParen(step.detail?.ko ?? '', floorLabel));
                                            return (
                                                <View style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                                    <Text style={{ fontFamily: 'Nunito-Bold', fontSize: 14, color: '#111116' }}>
                                                        {enPre ? <Text style={{ color: '#0090D2' }}>{enPre}{'  '}</Text> : null}{enRest}
                                                    </Text>
                                                    {step.detail?.ko ? (
                                                        <Text style={{ fontFamily: 'Pretendard-Regular', fontSize: 12, color: '#8E8E93', marginTop: 2 }}>
                                                            {koRest}
                                                        </Text>
                                                    ) : null}
                                                </View>
                                            );
                                        })()}
                                    </>
                                )}
                            </View>

                            {/* Exit chip / car position badge + elevator status dot */}
                            <View style={{ position: 'absolute', right: 4, top: viewMode === 'summary' ? 3 : 9, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            {step.car_position ? (
                                <View style={{
                                    borderRadius: 4,
                                    paddingHorizontal: 5,
                                    paddingVertical: 2,
                                    backgroundColor: step.car_position_uncertain ? '#EEEEF3' : '#7EC8E3',
                                }}>
                                    <Text style={{ fontSize: 9, fontFamily: 'Nunito-Bold', color: step.car_position_uncertain ? '#AAABB8' : '#1B2A4A' }}>
                                        {step.car_position}{step.car_position_uncertain ? '?' : ''}
                                    </Text>
                                </View>
                            ) : null}
                            {(() => {
                                const color = getElevatorStatusColor(step, elevatorStatuses);
                                if (!color) return null;
                                return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />;
                            })()}
                        </View>
                    </View>
                );})}
            </View>

            {/* ── Feedback row ── */}
            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingHorizontal: 12,
                paddingBottom: 10,
                paddingTop: 4,
                gap: 8,
            }}>
                <Text style={{ fontSize: 10, fontFamily: 'Nunito-Regular', color: '#AAABB8', marginRight: 4 }}>Is this guide accurate?</Text>
                
                <TouchableOpacity
                    onPress={() => handleFeedback('like')}
                    disabled={!!userFeedback}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: userFeedback === 'like' ? '#E0F2F1' : '#F7F7FA',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: userFeedback === 'like' ? '#2E5E4A' : '#E8E8EE',
                    }}
                >
                    <MaterialCommunityIcons 
                        name={userFeedback === 'like' ? 'thumb-up' : 'thumb-up-outline'} 
                        size={14} 
                        color={userFeedback === 'like' ? '#2E5E4A' : '#AAABB8'} 
                    />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => handleFeedback('dislike')}
                    disabled={!!userFeedback}
                    style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: userFeedback === 'dislike' ? '#FFF1F1' : '#F7F7FA',
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: userFeedback === 'dislike' ? '#C8362A' : '#E8E8EE',
                    }}
                >
                    <MaterialCommunityIcons 
                        name={userFeedback === 'dislike' ? 'thumb-down' : 'thumb-down-outline'} 
                        size={14} 
                        color={userFeedback === 'dislike' ? '#C8362A' : '#AAABB8'} 
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
}
