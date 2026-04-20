/**
 * StationScreen — 역 정보 탭
 * 기본: 역 목록 (라인 필터 + 검색)
 * 선택 후: 엘리베이터·화장실·ATM 등 상세 정보
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, StyleSheet, FlatList, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { getLineColor, getLineBadgeLabel } from '../utils/lineColors';
import { loadTranslationCache, tryTranslate } from '../utils/translation';
import {
    fetchStationElevators,
    fetchStationDisabledToilet, fetchStationToilet,
    fetchStationAtm, fetchStationLocker, fetchStationCnvFacl,
    fetchStationDairyRoom,
    getKricItems, elevatorStatusLabel,
    fetchSeoulElevatorStatus,
    fetchSubwayRouteInfo,
} from '../api/seoulApi';


// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
    primary:    '#2E5E4A',   // Namsan Pine Green
    green:      '#2E5E4A',   // Namsan Pine Green
    surface:    '#F7F7FA',   // Light BG
    card:       '#FFFFFF',
    border:     '#E8E8EE',
    textHigh:   '#1A1A1A',
    textMid:    '#757575',
    textLow:    '#AAABB8',
    chipBg:     '#FFFFFF',
};

// ── Line chip display label ───────────────────────────────────────────────────
function getChipLabel(line) {
    if (!line) return '';
    if (line.includes('공항')) return 'AREX';
    const n = String(line).replace(/호선$/, '').replace(/선$/, '');
    if (/^\d+$/.test(n)) return `Line ${n}`;
    return n;
}

// ── Line sort order ───────────────────────────────────────────────────────────
function lineSortKey(line) {
    if (!line) return 999;
    const n = parseInt(String(line).replace(/호선$/, ''));
    if (!isNaN(n)) return n;
    // Alphabetical for non-numeric lines
    return 100 + String(line).charCodeAt(0);
}

// ── Elevator status map ───────────────────────────────────────────────────────
const STATUS_MAP = {
    M: { color: '#4CAF50',  icon: 'check-circle-outline' },
    I: { color: '#F9A825',  icon: 'wrench-outline' },
    S: { color: '#EF6C00',  icon: 'hammer-wrench' },
    T: { color: '#C62828',  icon: 'alert-circle-outline' },
    B: { color: '#455A64',  icon: 'crane' },
};

// ── Haversine ─────────────────────────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Floor label ───────────────────────────────────────────────────────────────
function floorLabel(grndDvNm, floor) {
    if (!floor) return '';
    return `${grndDvNm === '지상' ? 'G' : 'B'}${floor}`;
}

// ── Line badge (circle) ───────────────────────────────────────────────────────
function LineBadge({ line }) {
    const color = getLineColor(line);
    const label = getLineBadgeLabel(line);
    return (
        <View style={[s.lineBadge, { backgroundColor: color }]}>
            <Text style={s.lineBadgeText}>{label}</Text>
        </View>
    );
}

// ── Station boolean icons ─────────────────────────────────────────────────────
function StationBooleanIcons({ can_cross_over, is_island_platform, is_inside_restroom }) {
    const activeRed = C.primary;
    const inactive  = '#8A9CA3';
    return (
        <View style={s.boolIconRow}>
            {/* Cross-over OK */}
            <MaterialCommunityIcons
                name="arrow-left-right"
                size={15}
                color={can_cross_over ? activeRed : inactive}
            />
            {/* Island Platform */}
            <View style={[s.ptIconWrap, { flexDirection: 'row', gap: 1.5 }]}>
                <View style={[s.ptBar, { backgroundColor: is_island_platform ? activeRed : inactive }]} />
                <View style={[s.ptBox, { borderColor: is_island_platform ? activeRed : inactive }]} />
                <View style={[s.ptBar, { backgroundColor: is_island_platform ? activeRed : inactive }]} />
            </View>
            {/* Inside Gate WC */}
            <Text style={[s.wcText, { color: is_inside_restroom ? activeRed : inactive }]}>WC</Text>
        </View>
    );
}

// ── Legend bar ────────────────────────────────────────────────────────────────
function LegendBar() {
    const [tooltip, setTooltip] = useState(null);
    const activeRed = C.primary;

    const items = [
        {
            key: 'crossover',
            title: 'Cross-over OK',
            en: 'You can cross to the opposite platform without going out of the gate.',
            kr: '개찰구 밖으로 나가지 않고 반대편 승강장으로 이동할 수 있습니다.',
            inactiveTitle: 'Separate Gates',
            inactiveEn: 'To go to the opposite side, you must exit and re-enter the gate.',
            inactiveKr: '반대편으로 가려면 개찰구 밖으로 나갔다 다시 들어와야 합니다.',
            icon: <MaterialCommunityIcons name="arrow-left-right" size={13} color={activeRed} style={{ marginRight: 4 }} />,
        },
        {
            key: 'island',
            title: 'Island Platform',
            en: 'The platform is in the center, with trains on both sides.',
            kr: '승강장이 가운데에 있고 양옆으로 열차가 섭니다.',
            inactiveTitle: 'Side Platform',
            inactiveEn: 'Platforms are on both sides. Check your direction before entering.',
            inactiveKr: '승강장이 양옆에 있어 방향에 맞는 개찰구로 들어가야 합니다.',
            icon: (
                <View style={[s.ptIconWrap, { flexDirection: 'row', gap: 1.5, marginRight: 4 }]}>
                    <View style={[s.ptBar, { backgroundColor: activeRed }]} />
                    <View style={[s.ptBox, { borderColor: activeRed }]} />
                    <View style={[s.ptBar, { backgroundColor: activeRed }]} />
                </View>
            ),
        },
        {
            key: 'wc',
            title: 'Inside Gate',
            en: "A restroom is available inside the station's paid area.",
            kr: '개찰구 안에 화장실이 있습니다.',
            inactiveTitle: 'Outside Gate',
            inactiveEn: 'The restroom is outside the gates.',
            inactiveKr: '화장실이 개찰구 바깥쪽에 있습니다.',
            icon: <Text style={[s.wcText, { color: activeRed, marginRight: 4 }]}>WC</Text>,
        },
    ];

    return (
        <View>
            <View style={s.legendBar}>
                {items.map(item => (
                    <TouchableOpacity
                        key={item.key}
                        style={[s.legendItem, tooltip?.key === item.key && s.legendItemActive]}
                        onPress={() => setTooltip(tooltip?.key === item.key ? null : item)}
                        activeOpacity={0.7}
                    >
                        {item.icon}
                        <Text style={s.legendText}>{item.title}</Text>
                        <MaterialCommunityIcons
                            name="information-outline"
                            size={11}
                            color={tooltip?.key === item.key ? C.primary : C.textLow}
                            style={{ marginLeft: 3 }}
                        />
                    </TouchableOpacity>
                ))}
            </View>

            <Modal
                animationType="fade"
                transparent
                visible={tooltip !== null}
                onRequestClose={() => setTooltip(null)}
            >
                <TouchableOpacity
                    style={s.tooltipOverlay}
                    onPress={() => setTooltip(null)}
                    activeOpacity={1}
                >
                    <View style={s.tooltipCard}>
                        <TouchableOpacity style={s.tooltipClose} onPress={() => setTooltip(null)}>
                            <MaterialCommunityIcons name="close" size={16} color={C.textLow} />
                        </TouchableOpacity>
                        {/* Active state — red */}
                        <Text style={s.tooltipTitle}>{tooltip?.title}</Text>
                        <Text style={s.tooltipEn}>{tooltip?.en}</Text>
                        <Text style={s.tooltipKr}>{tooltip?.kr}</Text>

                        <View style={s.tooltipDivider} />

                        {/* Inactive state — gray */}
                        <Text style={s.tooltipInactiveTitle}>{tooltip?.inactiveTitle}</Text>
                        <Text style={s.tooltipInactiveEn}>{tooltip?.inactiveEn}</Text>
                        <Text style={s.tooltipInactiveKr}>{tooltip?.inactiveKr}</Text>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

// ── Station list card ─────────────────────────────────────────────────────────
function StationListCard({ station, onPress, activeLine, isBranch, branchName }) {
    const sortedLines = [...station.lines].sort((a, b) => lineSortKey(a) - lineSortKey(b));

    return (
        <TouchableOpacity
            style={[s.stCard, isBranch && { paddingLeft: 32, backgroundColor: '#F8F9FF' }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={s.stCardMain}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={s.stCardEn} numberOfLines={1}>{station.name_en}</Text>
                    {isBranch && (
                        <View style={s.branchBadge}>
                            <Text style={s.branchBadgeText}>Branch</Text>
                        </View>
                    )}
                </View>
                <Text style={s.stCardKo} numberOfLines={1}>
                    {station.name_ko}
                    {isBranch && branchName ? <Text style={{ fontSize: 9, color: C.textLow }}> · {branchName}</Text> : null}
                </Text>
            </View>
            <View style={s.stCardRight}>
                <StationBooleanIcons
                    can_cross_over={station.can_cross_over}
                    is_island_platform={station.is_island_platform}
                    is_inside_restroom={station.is_inside_restroom}
                />
                {sortedLines.map(line => (
                    <LineBadge key={line} line={line} />
                ))}
                <MaterialCommunityIcons name="chevron-right" size={18} color={C.textLow} />
            </View>
        </TouchableOpacity>
    );
}

// ── LinePill (detail view) ────────────────────────────────────────────────────
function LinePill({ line }) {
    const color = getLineColor(line);
    const label = getLineBadgeLabel(line);
    return (
        <View style={[s.pill, { backgroundColor: color }]}>
            <Text style={s.pillText}>Line {label}</Text>
        </View>
    );
}

// ── Station info chips (detail view) ─────────────────────────────────────────
function StationInfoChips({ can_cross_over, is_island_platform, is_inside_restroom }) {
    const chips = [
        { active: can_cross_over,      activeLabel: 'Cross-over OK',  inactiveLabel: 'Separate Gates'  },
        { active: is_island_platform,  activeLabel: 'Island Platform', inactiveLabel: 'Side Platform'   },
        { active: is_inside_restroom,  activeLabel: 'Inside Restroom', inactiveLabel: 'Outside Restroom' },
    ];
    return (
        <View style={s.infoChipRow}>
            {chips.map(({ active, activeLabel, inactiveLabel }) => (
                <View
                    key={activeLabel}
                    style={[s.infoChip, active ? s.infoChipGreen : s.infoChipOrange]}
                >
                    <Text style={[s.infoChipText, { color: active ? '#1B5E20' : '#BF360C' }]}>
                        {active ? activeLabel : inactiveLabel}
                    </Text>
                </View>
            ))}
        </View>
    );
}

// ── Accordion section ─────────────────────────────────────────────────────────
function AccordionSection({ title, subTitle, icon, open, onToggle, children }) {
    return (
        <View style={s.section}>
            <TouchableOpacity style={s.sectionHeader} onPress={onToggle} activeOpacity={0.7}>
                <View style={s.sectionHeaderIconWrap}>{icon}</View>
                <View style={s.sectionHeaderTitleWrap}>
                    <Text style={s.sectionTitle}>{title}</Text>
                    {subTitle ? <Text style={s.sectionSubTitle}>{subTitle}</Text> : null}
                </View>
                <MaterialCommunityIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={24} color={C.textMid}
                />
            </TouchableOpacity>
            {open && <View style={s.sectionBody}>{children}</View>}
            <View style={s.sectionSep} />
        </View>
    );
}

// ── Not available ─────────────────────────────────────────────────────────────
function NotAvailable() {
    return (
        <View style={s.notAvailableWrap}>
            <Text style={s.notAvailableEn}>Not available at this station</Text>
            <Text style={s.notAvailableKo}>이 역에는 해당 시설이 없습니다</Text>
        </View>
    );
}

// ── Facilities summary bar ────────────────────────────────────────────────────
function FacilitiesSummaryBar({ elevators, disabledToilet, toilet, atm, locker, nursing }) {
    const icons = [
        { icon: 'elevator', label: 'Elev.',   has: elevators.length > 0 },
        { icon: 'human-male-female',  label: 'W.C',     has: (disabledToilet?.length > 0 || toilet?.length > 0) },
        { icon: 'atm',               label: 'ATM',     has: atm.length > 0 },
        { icon: 'lock-outline',       label: 'Locker',  has: locker.length > 0 },
        { icon: 'baby-bottle-outline',      label: 'Nursing', has: nursing.length > 0 },
    ];
    return (
        <View style={s.iconBar}>
            {icons.map(({ icon, label, has }) => (
                <View key={label} style={s.iconItem}>
                    <View style={[s.summaryIconBg, { backgroundColor: has ? C.primary : C.textLow }]}>
                        {label === 'ATM' ? (
                            <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>ATM</Text>
                        ) : (
                            <MaterialCommunityIcons
                                name={icon}
                                size={14}
                                color="#fff"
                            />
                        )}
                    </View>
                    <Text style={[s.iconLabel, !has && s.iconLabelDim]}>{label}</Text>
                </View>
            ))}
        </View>
    );
}

// ── Grouped facility list ─────────────────────────────────────────────────────
function FacilityGroupedList({ items, renderItem }) {
    if (items.length === 0) return <NotAvailable />;

    if (items.length <= 3) {
        return items.map((item, i) => renderItem(item, i, true));
    }

    const groups = new Map();
    for (const item of items) {
        const line = item._line || '';
        if (!groups.has(line)) groups.set(line, []);
        groups.get(line).push(item);
    }
    const multipleGroups = groups.size > 1;
    return [...groups.entries()].map(([line, lineItems]) => (
        <View key={line}>
            {multipleGroups && line ? (
                <View style={s.lineGroupHeader}>
                    <LinePill line={line} />
                </View>
            ) : null}
            {lineItems.map((item, i) => renderItem(item, i, false))}
        </View>
    ));
}

// ── Dot status indicator ──────────────────────────────────────────────────────
function StatusDot({ oprtngSitu }) {
    const status = elevatorStatusLabel(oprtngSitu);
    const info = STATUS_MAP[oprtngSitu] || { color: C.textLow, icon: 'help-circle-outline' };
    return (
        <View style={s.statusDotWrap}>
            <View style={[s.statusDot, { backgroundColor: info.color }]} />
            <View>
                <Text style={[s.statusDotEn, { color: info.color }]}>{status.en}</Text>
                <Text style={[s.statusDotKo, { color: info.color }]}>{status.ko}</Text>
            </View>
        </View>
    );
}

// ── Elevator item ─────────────────────────────────────────────────────────────
function ElevatorItem({ item, showLineBadge, showStatus }) {
    const isInternal = item.exitNo === '내부';
    const locationEn = isInternal ? 'Platform' : `Exit ${item.exitNo}`;
    const fromFloor = floorLabel(item.grndDvNmFr, item.runStinFlorFr);
    const toFloor   = floorLabel(item.grndDvNmTo, item.runStinFlorTo);
    const floorRange = fromFloor && toFloor ? `${fromFloor} ↔ ${toFloor}` : '';

    return (
        <View style={s.facilityItem}>
            <View style={s.facilityItemContent}>
                <View style={s.facilityItemTitleRow}>
                    <Text style={s.facilityItemMain} numberOfLines={1}>
                        {(tryTranslate(item.dtlLoc) || locationEn).replace(/방면(\d)/g, '방면 $1')}
                    </Text>
                    <View style={[s.miniTag, isInternal ? s.miniTagPurple : s.miniTagAmber]}>
                        <Text style={[s.miniTagText, isInternal ? s.miniTagTextPurple : s.miniTagTextAmber]}>
                            {locationEn}
                        </Text>
                    </View>
                </View>
                {floorRange ? <Text style={s.facilityItemSub}>{floorRange}</Text> : null}
            </View>
            {showStatus
                ? <StatusDot oprtngSitu={item.oprtngSitu} />
                : showLineBadge && item._line
                    ? <LinePill line={item._line} />
                    : null
            }
        </View>
    );
}

// ── Restroom item ─────────────────────────────────────────────────────────────
function RestroomItem({ item, showLineBadge }) {
    const isInside    = item.gateInotDvNm === '내';
    const isAccessible = item.disabWcDvNm === '유' || (item.dtlLoc && item.dtlLoc.includes('장애인'));

    const genders = item.genders || [item.mlFmlDvNm];
    const uniqueGenders = [...new Set(genders)].filter(Boolean);
    const hasMen   = uniqueGenders.some(g => g === '남자' || g === '남녀공용');
    const hasWomen = uniqueGenders.some(g => g === '여자' || g === '남녀공용');

    let genderEn = '';
    if (hasMen && !hasWomen) genderEn = 'Men';
    else if (hasWomen && !hasMen) genderEn = 'Women';

    const genderKo = (hasMen && hasWomen) ? '' : uniqueGenders.join('/');
    const floor = floorLabel(item.grndDvNm, item.stinFlor);
    const exitEn = item.exitNo && item.exitNo !== '내부' ? `Exit ${item.exitNo}` : null;
    const locationTag = isInside ? 'Inside gate' : 'Outside gate';

    return (
        <View style={s.facilityItem}>
            <View style={s.facilityItemContent}>
                <View style={s.facilityItemTitleRow}>
                    <Text style={s.facilityItemMain}>
                        {[genderEn, floor, exitEn].filter(Boolean).join(' · ')}
                    </Text>
                    <View style={[s.miniTag, isInside ? s.miniTagGreen : s.miniTagOrange]}>
                        <Text style={[s.miniTagText, isInside ? s.miniTagTextGreen : s.miniTagTextOrange]}>
                            {locationTag}
                        </Text>
                    </View>
                    {isAccessible && (
                        <View style={s.miniTagPurple}>
                            <MaterialCommunityIcons name="wheelchair-accessibility" size={13} color="#4527A0" />
                        </View>
                    )}
                </View>
                <Text style={s.facilityItemSub}>{[genderKo, tryTranslate(item.dtlLoc)].filter(Boolean).join(' · ')}</Text>
            </View>
            {showLineBadge && item._line ? <LinePill line={item._line} /> : null}
        </View>
    );
}

// ── ATM item ──────────────────────────────────────────────────────────────────
function ATMItem({ item, showLineBadge }) {
    const floor = floorLabel(item.grndDvNm, item.stinFlor);
    const exitEn = item.exitNo && item.exitNo !== '내부' ? `Exit ${item.exitNo}` : null;
    const hours = item.utlPsbHr || '';

    return (
        <View style={s.facilityItem}>
            <View style={s.facilityItemContent}>
                <View style={s.facilityItemTitleRow}>
                    <Text style={s.facilityItemMain}>
                        {[floor, exitEn, tryTranslate(item.dtlLoc)].filter(Boolean).join(' · ') || 'ATM'}
                    </Text>
                </View>
                {hours       ? <Text style={s.facilityItemSub}>{hours}</Text>                     : null}
            </View>
            {showLineBadge && item._line ? <LinePill line={item._line} /> : null}
        </View>
    );
}

// ── Nursing room item ─────────────────────────────────────────────────────────
function NursingRoomItem({ item, showLineBadge }) {
    const floor = floorLabel(item.grndDvNm, item.stinFlor);
    const exitEn = item.exitNo && item.exitNo !== '내부' ? `Exit ${item.exitNo}` : null;

    const facilities = [];
    if (item.sofaCnt > 0) facilities.push(`Sofa ×${item.sofaCnt}`);
    if (item.microwaveCnt > 0) facilities.push(`Microwave ×${item.microwaveCnt}`);
    if (item.diaperExchgTablCnt > 0) facilities.push(`Diaper Table ×${item.diaperExchgTablCnt}`);
    if (item.washBasinCnt > 0) facilities.push(`Sink ×${item.washBasinCnt}`);
    if (item.coldHotWtrDispnsr === '유') facilities.push('Water Dispenser');
    
    const facilitiesText = facilities.join(', ');

    return (
        <View style={s.facilityItem}>
            <View style={s.facilityItemContent}>
                <View style={s.facilityItemTitleRow}>
                    <Text style={s.facilityItemMain}>
                        {[floor, exitEn, tryTranslate(item.dtlLoc)].filter(Boolean).join(' · ') || 'Nursing Room'}
                    </Text>
                </View>
                {facilitiesText ? <Text style={s.facilityItemSub}>{facilitiesText}</Text> : null}
            </View>
            {showLineBadge && item._line ? <LinePill line={item._line} /> : null}
        </View>
    );
}

// ── Locker size map ───────────────────────────────────────────────────────────
const LOCKER_SIZE = {
    '소':  'S',
    '중':  'M',
    '대':  'L',
    '특대': 'XL',
};

// ── Locker item ───────────────────────────────────────────────────────────────
function LockerItem({ item, showLineBadge }) {
    const floor = floorLabel(item.grndDvNm, item.stinFlor);
    const exitEn = item.exitNo && item.exitNo !== '내부' ? `Exit ${item.exitNo}` : null;

    const sizeSummary = (item.sizes || []).map(s => {
        const sz = LOCKER_SIZE[s.szNm] || s.szNm;
        return `${sz}×${s.faclNum}`;
    }).join(', ');

    const fees = [...new Set((item.sizes || []).map(s => s.utlFare).filter(Boolean))];
    const feeText = fees.length > 0 ? `${fees.join('/')}원` : '';

    return (
        <View style={s.facilityItem}>
            <View style={s.facilityItemContent}>
                <View style={s.facilityItemTitleRow}>
                    <Text style={s.facilityItemMain}>
                        {[floor, exitEn, tryTranslate(item.dtlLoc)].filter(Boolean).join(' · ') || 'Locker'}
                    </Text>
                </View>
                {sizeSummary ? <Text style={s.facilityItemSub}>{sizeSummary}</Text> : null}
                {feeText     ? <Text style={s.facilityItemSub}>{feeText}</Text> : null}
            </View>
            {showLineBadge && item._line ? <LinePill line={item._line} /> : null}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function StationScreen() {
    const insets = useSafeAreaInsets();

    // ── List view state ───────────────────────────────────────────────────────
    const [stationList, setStationList]       = useState([]);
    const [availableLines, setAvailableLines] = useState([]);
    const [listLoading, setListLoading]       = useState(true);
    const [lineFilter, setLineFilter]         = useState('all');
    const [searchQuery, setSearchQuery]       = useState('');

    // ── Detail view state ─────────────────────────────────────────────────────
    const [station, setStation]       = useState(null);
    const [allLines, setAllLines]     = useState([]);
    const [gpsLoading, setGpsLoading] = useState(false);

    // Stop sequence state for line-based sorting
    const [lineSequences, setLineSequences] = useState({});
    const [, setSeqLoading] = useState(false);

    const facilityCache = useRef({});

    const [facilityLoading, setFacilityLoading] = useState(false);
    const [facilityData, setFacilityData] = useState({
        elevators: [], disabledToilet: [], toilet: [], atm: [], locker: [], nursing: [],
    });
    const [openSections, setOpenSections] = useState(
        new Set(['elevators', 'restrooms', 'atm', 'lockers', 'nursing'])
    );

    useEffect(() => { loadTranslationCache(); }, []);

    useEffect(() => {
        supabase
            .from('stations')
            .select('id, name_ko, name_en, line, platform_type, stin_cd, kric_opr_cd, ln_cd, can_cross_over, is_island_platform, is_inside_restroom')
            .order('name_en')
            .then(({ data }) => {
                const map = new Map();
                for (const row of (data || [])) {
                    const key = row.name_ko;
                    const lineInfo = {
                        name: row.line,
                        oprCd: row.kric_opr_cd,
                        lnCd: row.ln_cd,
                        stinCd: row.stin_cd
                    };

                    if (!map.has(key)) {
                        map.set(key, {
                            id: row.id,
                            name_ko: row.name_ko,
                            name_en: row.name_en,
                            lines: row.line ? [row.line] : [],
                            lineData: row.line ? [lineInfo] : [],
                            platform_type: row.platform_type,
                            can_cross_over: row.can_cross_over,
                            is_island_platform: row.is_island_platform,
                            is_inside_restroom: row.is_inside_restroom,
                        });
                    } else {
                        const st = map.get(key);
                        if (row.line && !st.lines.includes(row.line)) {
                            st.lines.push(row.line);
                            st.lineData.push(lineInfo);
                            // Sort lines to ensure they are always stored in order
                            st.lines.sort((a, b) => lineSortKey(a) - lineSortKey(b));
                            st.lineData.sort((a, b) => lineSortKey(a.name) - lineSortKey(b.name));
                        }
                    }
                }
                const list = Array.from(map.values());
                setStationList(list);

                const lineSet = new Set();
                list.forEach(st => st.lines.forEach(l => lineSet.add(l)));
                const sorted = [...lineSet].sort((a, b) => lineSortKey(a) - lineSortKey(b));
                setAvailableLines(sorted);
                console.log('[Station] Available lines:', sorted);
                setListLoading(false);
            });
    }, []);

    // ── Fetch line sequence when filter changes ───────────────────────────────
    useEffect(() => {
        if (lineFilter === 'all' || lineSequences[lineFilter]) return;

        setSeqLoading(true);
        (async () => {
            try {
                // Find any station code on this line to get lnCd
                const sampleStation = stationList.find(st => st.lines.includes(lineFilter));
                if (!sampleStation) return;

                const codes = sampleStation.lineData?.find(ld => ld.name === lineFilter);
                if (!codes?.lnCd) return;

                const res = await fetchSubwayRouteInfo({ lnCd: codes.lnCd });
                const items = getKricItems(res);
                console.log(`[Station] Fetched ${items.length} sequence items for ${lineFilter}`);
                if (items.length > 0) {
                    const seqData = {};
                    items.forEach(it => {
                        const cleanName = (it.stinNm || '').replace(/역$/, '').trim();
                        seqData[cleanName] = {
                            order: parseInt(it.stinConsOrdr),
                            branch: it.brlnNm || null,
                            rawName: it.stinNm
                        };
                    });
                    console.log(`[Station] ${lineFilter} payload:`, Object.keys(seqData).slice(0, 10), '...');
                    setLineSequences(prev => ({ ...prev, [lineFilter]: seqData }));
                }
            } catch (e) {
                console.warn('[Station] Failed to fetch sequence:', e);
            } finally {
                setSeqLoading(false);
            }
        })();
    }, [lineFilter, stationList]);

    // ── Filtered list ─────────────────────────────────────────────────────────
    const filteredList = useMemo(() => {
        let list = [...stationList];
        if (lineFilter !== 'all') {
            list = list.filter(st => st.lines.includes(lineFilter));
            
            const seq = lineSequences[lineFilter];
            if (seq) {
                // Separate Main vs Branches
                const mainStations = [];
                const branchGroups = {}; // branchName -> stations[]

                list.forEach(st => {
                    const dbClean = st.name_ko.replace(/역$/, '').replace(/\((지하|지상)\)$/, '').trim();
                    const info = seq[dbClean] || Object.values(seq).find(v => v.rawName.includes(dbClean) || dbClean.includes(v.rawName.replace(/역$/, '')));
                    
                    if (!info) {
                        mainStations.push(st);
                        return;
                    }

                    // Attach matched sequence order to the station object temporarily for sorting
                    st._matchOrder = info.order;
                    const branchLabel = getManualBranchLabel(lineFilter, info.order) || info.branch;

                    const isActuallyBranch = branchLabel && 
                        branchLabel !== lineFilter && 
                        !branchLabel.includes('본선') &&
                        !branchLabel.includes('순환선');

                    if (isActuallyBranch) {
                        if (!branchGroups[branchLabel]) branchGroups[branchLabel] = [];
                        branchGroups[branchLabel].push(st);
                    } else {
                        mainStations.push(st);
                    }
                });

                // Sort main by order
                const getOrder = (st) => st._matchOrder ?? 999;
                mainStations.sort((a, b) => getOrder(a) - getOrder(b));

                // Sort branches by order
                Object.values(branchGroups).forEach(group => {
                    group.sort((a, b) => getOrder(a) - getOrder(b));
                });

                // Composite list: Insert branches after junctions
                const JUNCTIONS = {
                    '2': { '성수': '성수지선', '신도림': '신정지선' },
                    '5': { '강동': '마천지선' },
                };

                const composite = [];
                // Use normalized key for junctions
                const normalizedKey = lineFilter.replace(/호선$/, '').replace(/선$/, '');
                const lineJunctions = JUNCTIONS[normalizedKey] || {};
                const unmatchedBranches = new Set(Object.keys(branchGroups));
                
                console.log(`[Station] Building composite for ${lineFilter} (key: ${normalizedKey}). Junctions:`, Object.keys(lineJunctions));

                mainStations.forEach(st => {
                    composite.push({ ...st, isBranch: false });
                    const cleanNm = st.name_ko.replace(/역$/, '');
                    
                    // Check if this station is a junction
                    Object.entries(lineJunctions).forEach(([junctNm, branchPart]) => {
                        if (cleanNm === junctNm) {
                            // Find which branch name from API matches this junction's target
                            // e.g. API might say '성수지선(성수-신설동)' while we have '성수지선'
                            Object.keys(branchGroups).forEach(apiBranchNm => {
                                if (apiBranchNm.includes(branchPart)) {
                                    branchGroups[apiBranchNm].forEach(bst => {
                                        composite.push({ ...bst, isBranch: true, branchName: branchPart });
                                    });
                                    unmatchedBranches.delete(apiBranchNm);
                                }
                            });
                        }
                    });
                });

                // Append any remaining branches that weren't matched to junctions
                unmatchedBranches.forEach(branchNm => {
                    branchGroups[branchNm].forEach(bst => {
                        composite.push({ ...bst, isBranch: true, branchName: branchNm });
                    });
                });

                list = composite;
            }
        } else {
            list.sort((a, b) => (a.name_en || '').localeCompare(b.name_en || ''));
        }

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(st =>
                st.name_en?.toLowerCase().includes(q) ||
                st.name_ko?.includes(searchQuery.trim())
            );
        }
        return list;
    }, [stationList, lineFilter, searchQuery, lineSequences]);

    // ── Helper: Manual branch labeling based on order ────────────────────────
    function getManualBranchLabel(line, order) {
        const key = line.replace(/호선$/, '').replace(/선$/, '');
        if (key === '2') {
            if (order >= 44 && order <= 47) return '성수지선';
            if (order >= 48 && order <= 51) return '신정지선';
        }
        if (key === '5') {
            if (order >= 46 && order <= 53) return '마천지선';
        }
        return null;
    }

    // ── Facility data load ────────────────────────────────────────────────────
    const loadFacilityData = async (st, lines) => {
        const cacheKey = st.name_ko;
        setFacilityLoading(true);
        try {
            let seoulStatus = [];
            try {
                seoulStatus = await fetchSeoulElevatorStatus(st.name_ko);
            } catch (err) {
                console.warn('[Station] Failed to fetch Seoul elevator status:', err);
            }

            const lineResults = await Promise.allSettled(
                lines.map(async (line) => {
                    const codes = st.lineData?.find(ld => ld.name === line);
                    if (!codes) { console.warn('[Station] No codes for line:', line, st.name_ko); return { line, data: null }; }

                    const p = { railOprIsttCd: codes.oprCd, lnCd: codes.lnCd, stinCd: codes.stinCd };
                    console.log('[Station] Fetching facility for', st.name_ko, line, p);
                    const [elevR, disWcR, wcR, atmR, lockerR, cnvR, nursingR] = await Promise.allSettled([
                        fetchStationElevators(p),
                        fetchStationDisabledToilet(p),
                        fetchStationToilet(p),
                        fetchStationAtm(p),
                        fetchStationLocker(p),
                        fetchStationCnvFacl(p),
                        fetchStationDairyRoom(p),
                    ]);
                    const safe = (r) => getKricItems(r.status === 'fulfilled' ? r.value : null);

                    const elevatorsRaw = safe(elevR);
                    const elevators = elevatorsRaw.map(elev => {
                        const statusItem = seoulStatus.find(s =>
                            (s.dtlPstn && elev.dtlLoc && (s.dtlPstn.includes(elev.dtlLoc) || elev.dtlLoc.includes(s.dtlPstn))) ||
                            (s.mngNo && elev.exitNo && s.mngNo.includes(elev.exitNo))
                        );
                        return {
                            ...elev,
                            oprtngSitu: statusItem ? statusItem.oprtngSitu : (elev.oprtngSitu || 'M')
                        };
                    });

                    return {
                        line,
                        data: {
                            elevators,
                            disabledToilet: safe(disWcR),
                            toilet: safe(wcR),
                            atm: safe(atmR),
                            locker: safe(lockerR),
                            nursing: safe(nursingR),
                        },
                    };
                })
            );

            const mergeAndDedup = (key) => {
                const all = [];
                for (const r of lineResults) {
                    if (r.status !== 'fulfilled' || !r.value?.data) continue;
                    for (const item of (r.value.data[key] || [])) {
                        all.push({ ...item, _line: r.value.line });
                    }
                }
                if (key === 'toilet') {
                    const grouped = new Map();
                    all.forEach(item => {
                        const locKey = [
                            item.dtlLoc || '',
                            item.stinFlor ?? '',
                            item.exitNo ?? '',
                            item.gateInotDvNm || '',
                        ].join('|');
                        if (!grouped.has(locKey)) {
                            grouped.set(locKey, { ...item, genders: [item.mlFmlDvNm] });
                        } else {
                            const existing = grouped.get(locKey);
                            if (item.mlFmlDvNm && !existing.genders.includes(item.mlFmlDvNm)) {
                                existing.genders.push(item.mlFmlDvNm);
                            }
                            if (item.disabWcDvNm === '유' || (item.dtlLoc && item.dtlLoc.includes('장애인'))) {
                                existing.disabWcDvNm = '유';
                            }
                        }
                    });
                    return Array.from(grouped.values());
                }

                if (key === 'locker') {
                    const grouped = new Map();
                    all.forEach(item => {
                        const locKey = [
                            item.dtlLoc || '',
                            item.stinFlor ?? '',
                            item.exitNo ?? '',
                        ].join('|');
                        if (!grouped.has(locKey)) {
                            grouped.set(locKey, { ...item, sizes: [{ szNm: item.szNm, faclNum: item.faclNum, utlFare: item.utlFare }] });
                        } else {
                            const existing = grouped.get(locKey);
                            existing.sizes.push({ szNm: item.szNm, faclNum: item.faclNum, utlFare: item.utlFare });
                        }
                    });
                    return Array.from(grouped.values());
                }

                const seen = new Set();
                return all.filter((item) => {
                    const dedupKey = [
                        item.dtlLoc || '',
                        item.stinFlor ?? '',
                        item.exitNo ?? '',
                        item.bkNm || item.bankNm || item.firnm || '',
                    ].join('|');
                    if (seen.has(dedupKey)) return false;
                    seen.add(dedupKey);
                    return true;
                });
            };

            const result = {
                elevators:      mergeAndDedup('elevators'),
                disabledToilet: mergeAndDedup('disabledToilet'),
                toilet:         mergeAndDedup('toilet'),
                atm:            mergeAndDedup('atm'),
                locker:         mergeAndDedup('locker'),
                nursing:        mergeAndDedup('nursing'),
            };
            console.log('[Station] Facility result:', Object.entries(result).map(([k, v]) => `${k}:${v.length}`).join(', '));
            facilityCache.current[cacheKey] = result;
            setFacilityData(result);
        } finally {
            setFacilityLoading(false);
        }
    };

    // ── Station select ────────────────────────────────────────────────────────
    const handleSelectStation = async (st) => {
        setStation(st);

        let finalLines = st.lines?.length > 0 ? st.lines : (st.line ? [st.line] : []);
        // Always sort lines for consistent display (e.g., Line 1, Line 3)
        finalLines = [...finalLines].sort((a, b) => lineSortKey(a) - lineSortKey(b));
        setAllLines(finalLines);

        if (facilityCache.current[st.name_ko]) {
            setFacilityData(facilityCache.current[st.name_ko]);
            return;
        }

        await loadFacilityData(st, finalLines);
    };

    // ── GPS ───────────────────────────────────────────────────────────────────
    const triggerGps = async () => {
        setGpsLoading(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            const { latitude, longitude } = pos.coords;

            const { data: stations } = await supabase
                .from('stations')
                .select('id, name_ko, name_en, line, latitude, longitude');
            if (!stations?.length) return;

            const nearest = stations
                .filter(s => s.latitude && s.longitude)
                .map(s => ({ ...s, dist: haversine(latitude, longitude, s.latitude, s.longitude) }))
                .sort((a, b) => a.dist - b.dist)[0];

            if (nearest) await handleSelectStation(nearest);
        } catch (_) { /* silent */ }
        finally { setGpsLoading(false); }
    };

    // ── Accordion toggle ──────────────────────────────────────────────────────
    const toggleSection = (key) => {
        setOpenSections(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────
    return (
        <View style={[s.root, { paddingTop: insets.top }]}>

            {/* ════════════════ LIST VIEW ════════════════ */}
            {!station ? (
                <>
                    {/* Search bar */}
                    <View style={s.listSearchWrap}>
                        <View style={s.listSearchBar}>
                            <MaterialCommunityIcons name="magnify" size={22} color="#777" style={{ marginRight: 10 }} />
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                    placeholder="Search Station..."
                                    placeholderTextColor={C.textLow}
                                    style={s.listSearchInput}
                                    clearButtonMode="while-editing"
                                />
                                {!searchQuery ? (
                                    <Text style={s.listSearchHintKo}>역 이름 검색</Text>
                                ) : null}
                            </View>
                            {gpsLoading
                                ? <ActivityIndicator size="small" color={C.primary} style={{ marginLeft: 8 }} />
                                : (
                                    <TouchableOpacity style={s.listSearchBtn} onPress={triggerGps}>
                                        <MaterialCommunityIcons name="crosshairs-gps" size={16} color="#fff" />
                                    </TouchableOpacity>
                                )
                            }
                        </View>
                    </View>

                    {/* Line filter chips */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={s.chipScrollView}
                        contentContainerStyle={s.chipRow}
                    >
                        <TouchableOpacity
                            style={[
                                s.chip,
                                lineFilter === 'all' ? s.chipActive : { borderColor: C.textLow }
                            ]}
                            onPress={() => setLineFilter('all')}
                        >
                            <Text style={[
                                s.chipText,
                                lineFilter === 'all' ? s.chipTextActive : { color: C.textMid }
                            ]}>
                                All
                            </Text>
                        </TouchableOpacity>
                        {availableLines.map(line => (
                            <TouchableOpacity
                                key={line}
                                style={[
                                    s.chip,
                                    lineFilter === line
                                        ? { backgroundColor: getLineColor(line), borderColor: getLineColor(line) }
                                        : { borderColor: getLineColor(line) },
                                ]}
                                onPress={() => setLineFilter(line)}
                            >
                                <Text style={[
                                    s.chipText,
                                    lineFilter === line ? s.chipTextActive : { color: getLineColor(line) },
                                ]}>
                                    {getChipLabel(line)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {/* Legend */}
                    <LegendBar />

                    {/* Station list */}
                    {listLoading ? (
                        <View style={s.listLoading}>
                            <ActivityIndicator color={C.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredList}
                            keyExtractor={item => item.name_ko}
                            ItemSeparatorComponent={() => <View style={s.stListSeparator} />}
                            renderItem={({ item }) => (
                                <StationListCard
                                    station={item}
                                    activeLine={lineFilter}
                                    isBranch={item.isBranch}
                                    branchName={item.branchName}
                                    onPress={() => handleSelectStation(item)}
                                />
                            )}
                            contentContainerStyle={{ paddingTop: 6, paddingBottom: insets.bottom + 80 }}
                            showsVerticalScrollIndicator={false}
                            ListEmptyComponent={
                                <View style={s.emptyList}>
                                    <Text style={s.emptyListText}>No stations found</Text>
                                </View>
                            }
                        />
                    )}
                </>

            ) : (
                /* ════════════════ DETAIL VIEW ════════════════ */
                <>
                    {/* Back header */}
                    <TouchableOpacity style={s.backHeader} onPress={() => setStation(null)} activeOpacity={0.7}>
                        <MaterialCommunityIcons name="arrow-left" size={22} color={C.textHigh} />
                        <View style={{ marginLeft: 10 }}>
                            <Text style={s.backHeaderEn} numberOfLines={1}>{station.name_en}</Text>
                            <Text style={s.backHeaderKo}>{station.name_ko}</Text>
                        </View>
                    </TouchableOpacity>

                    <ScrollView
                        style={s.scroll}
                        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* ── Station header ── */}
                        <View style={s.stationHeader}>
                            <View style={s.stationNameRow}>
                                <Text style={s.stationNameEn}>{station.name_en}</Text>
                                <View style={s.stationNamePills}>
                                    {allLines.map(line => <LinePill key={line} line={line} />)}
                                </View>
                            </View>
                            <Text style={s.stationNameKo}>{station.name_ko}</Text>
                            <View style={{ marginTop: 10 }}>
                                <StationInfoChips
                                    can_cross_over={station.can_cross_over}
                                    is_island_platform={station.is_island_platform}
                                    is_inside_restroom={station.is_inside_restroom}
                                />
                            </View>
                        </View>

                        {/* ── Facilities summary bar ── */}
                        {!facilityLoading && (
                            <FacilitiesSummaryBar
                                elevators={facilityData.elevators}
                                disabledToilet={facilityData.disabledToilet}
                                toilet={facilityData.toilet}
                                atm={facilityData.atm}
                                locker={facilityData.locker}
                                nursing={facilityData.nursing}
                            />
                        )}

                        {facilityLoading ? (
                            <View style={s.facilityLoading}>
                                <ActivityIndicator color={C.primary} />
                                <Text style={s.facilityLoadingText}>Loading facility data...</Text>
                            </View>
                        ) : (
                            <>
                                {/* ── Elevators ── */}
                                <AccordionSection
                                    title="Elevators"
                                    subTitle="엘리베이터"
                                    icon={
                                        <View style={[s.headerIconBg, { backgroundColor: C.primary }]}>
                                            <MaterialCommunityIcons name="elevator" size={18} color="#fff" />
                                        </View>
                                    }
                                    open={openSections.has('elevators')}
                                    onToggle={() => toggleSection('elevators')}
                                >
                                    <FacilityGroupedList
                                        items={facilityData.elevators}
                                        renderItem={(item, i, showBadge) => (
                                            <ElevatorItem
                                                key={i}
                                                item={item}
                                                showLineBadge={showBadge && allLines.length > 1}
                                                showStatus={true}
                                            />
                                        )}
                                    />
                                </AccordionSection>

                                {/* ── Restrooms ── */}
                                <AccordionSection
                                    title="Restrooms"
                                    subTitle="화장실"
                                    icon={
                                        <View style={[s.headerIconBg, { backgroundColor: C.primary }]}>
                                            <MaterialCommunityIcons name="human-male-female" size={18} color="#fff" />
                                        </View>
                                    }
                                    open={openSections.has('restrooms')}
                                    onToggle={() => toggleSection('restrooms')}
                                >
                                    <FacilityGroupedList
                                        items={facilityData.toilet}
                                        renderItem={(item, i, showBadge) => (
                                            <RestroomItem
                                                key={i}
                                                item={item}
                                                showLineBadge={showBadge && allLines.length > 1}
                                            />
                                        )}
                                    />
                                </AccordionSection>

                                {/* ── ATM ── */}
                                <AccordionSection
                                    title="ATM"
                                    subTitle="ATM"
                                    icon={
                                        <View style={[s.headerIconBg, { backgroundColor: C.primary }]}>
                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>ATM</Text>
                                        </View>
                                    }
                                    open={openSections.has('atm')}
                                    onToggle={() => toggleSection('atm')}
                                >
                                    <FacilityGroupedList
                                        items={facilityData.atm}
                                        renderItem={(item, i, showBadge) => (
                                            <ATMItem
                                                key={i}
                                                item={item}
                                                showLineBadge={showBadge && allLines.length > 1}
                                            />
                                        )}
                                    />
                                </AccordionSection>

                                {/* ── Lockers ── */}
                                <AccordionSection
                                    title="Lockers"
                                    subTitle="물품보관함"
                                    icon={
                                        <View style={[s.headerIconBg, { backgroundColor: C.primary }]}>
                                            <MaterialCommunityIcons name="lock-outline" size={18} color="#fff" />
                                        </View>
                                    }
                                    open={openSections.has('lockers')}
                                    onToggle={() => toggleSection('lockers')}
                                >
                                    <View style={{ paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#F9F9FB' }}>
                                        <Text style={{ fontSize: 10, color: '#888', lineHeight: 14 }}>
                                            S: Handbag, Backpack / M: Carry-on Carrier / L: Large Suitcase
                                        </Text>
                                        <Text style={{ fontSize: 10, color: '#AAA', marginTop: 1 }}>
                                            S: 핸드백, 배낭 / M: 기내용 캐리어 / L: 대형 캐리어
                                        </Text>
                                    </View>
                                    <FacilityGroupedList
                                        items={facilityData.locker}
                                        renderItem={(item, i, showBadge) => (
                                            <LockerItem
                                                key={i}
                                                item={item}
                                                showLineBadge={showBadge && allLines.length > 1}
                                            />
                                        )}
                                    />
                                </AccordionSection>

                                {/* ── Nursing Room ── */}
                                <AccordionSection
                                    title="Nursing Room"
                                    subTitle="수유실"
                                    icon={
                                        <View style={[s.headerIconBg, { backgroundColor: C.primary }]}>
                                            <MaterialCommunityIcons name="baby-bottle-outline" size={18} color="#fff" />
                                        </View>
                                    }
                                    open={openSections.has('nursing')}
                                    onToggle={() => toggleSection('nursing')}
                                >
                                    <FacilityGroupedList
                                        items={facilityData.nursing}
                                        renderItem={(item, i, showBadge) => (
                                            <NursingRoomItem
                                                key={i}
                                                item={item}
                                                showLineBadge={showBadge && allLines.length > 1}
                                            />
                                        )}
                                    />
                                </AccordionSection>
                            </>
                        )}
                    </ScrollView>
                </>
            )}
        </View>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.surface },

    // ── List view ─────────────────────────────────────────────────────────────
    listSearchWrap: {
        paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8,
        backgroundColor: C.surface,
    },
    listSearchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#EEEEF3',
        borderRadius: 14,
        borderWidth: 0.5, borderColor: '#E8E8EE',
        paddingHorizontal: 14, paddingVertical: 11,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08, shadowRadius: 6,
        elevation: 3,
    },
    listSearchInput: {
        fontSize: 16, fontFamily: 'Nunito-SemiBold', color: C.textHigh,
        padding: 0,
    },
    listSearchHintKo: {
        fontSize: 11, fontFamily: 'Pretendard-Regular', color: C.textLow, marginTop: 2,
    },
    listSearchBtn: {
        backgroundColor: C.primary,
        borderRadius: 20,
        width: 34, height: 34,
        justifyContent: 'center', alignItems: 'center',
        marginLeft: 8,
    },

    chipScrollView: { flexGrow: 0, flexShrink: 0, minHeight: 40, backgroundColor: C.surface },
    chipRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 10, paddingTop: 5, paddingBottom: 5, gap: 8,
    },
    chip: {
        paddingHorizontal: 4, paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: C.chipBg,
        borderWidth: 1.5, borderColor: C.border,
        width: 56, alignItems: 'center', justifyContent: 'center',
    },
    chipActive: {
        backgroundColor: C.primary,
        borderColor: C.primary,
    },
    chipText: { fontSize: 12, fontFamily: 'Nunito-ExtraBold', color: C.textHigh },
    chipTextActive: { color: '#fff' },

    legendBar: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-evenly',
        paddingHorizontal: 16, paddingVertical: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: C.border,
        backgroundColor: '#F0F0F5',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    legendItemActive: { backgroundColor: '#E8E8EE' },
    legendText: { fontSize: 11, fontFamily: 'Nunito-Regular', color: C.textLow },

    tooltipOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.25)',
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 150,
    },
    tooltipCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        padding: 16,
        paddingTop: 20,
        width: '85%',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15, shadowRadius: 6,
    },
    tooltipClose: { position: 'absolute', top: 8, right: 8 },
    tooltipTitle: { fontSize: 14, fontFamily: 'Nunito-Bold', color: C.primary, marginBottom: 6 },
    tooltipEn: { fontSize: 12, color: C.primary, marginBottom: 3 },
    tooltipKr: { fontSize: 12, color: C.primary },
    tooltipDivider: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginVertical: 10 },
    tooltipInactiveTitle: { fontSize: 14, fontFamily: 'Nunito-Bold', color: '#9E9E9E', marginBottom: 6 },
    tooltipInactiveEn: { fontSize: 12, color: '#9E9E9E', marginBottom: 3 },
    tooltipInactiveKr: { fontSize: 12, color: '#9E9E9E' },

    // Platform mini icon boxes
    ptIconWrap: { alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    ptBox: {
        width: 11, height: 11,
        borderWidth: 1.5, borderRadius: 2,
    },

    listLoading: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

    // Station list item
    stCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: C.card,
        paddingHorizontal: 16, paddingVertical: 15,
    },
    stListSeparator: {
        height: 1, backgroundColor: C.border,
        marginLeft: 16, marginRight: 16,
    },
    stCardMain: { flex: 1 },
    stCardEn: {
        fontSize: 16, fontFamily: 'Nunito-Bold', color: C.textHigh,
        marginBottom: 1,
    },
    branchBadge: {
        marginLeft: 8,
        backgroundColor: '#E8EAF6',
        paddingHorizontal: 6, paddingVertical: 2,
        borderRadius: 4,
    },
    branchBadgeText: {
        fontSize: 10, fontFamily: 'Nunito-Bold', color: '#3F51B5',
    },
    stCardKo: {
        fontSize: 11, color: C.textMid,
        marginTop: 1,
    },
    stCardRight: { flexDirection: 'row', alignItems: 'center', gap: 5 },

    // Boolean icons on card
    boolIconRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 2 },
    wcText: { fontSize: 10, fontWeight: '800' },
    ptBar: { width: 2, height: 11, borderRadius: 1 },

    lineBadge: {
        width: 24, height: 24, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    lineBadgeText: { color: '#fff', fontSize: 10, fontFamily: 'Nunito-ExtraBold' },

    emptyList: { paddingTop: 60, alignItems: 'center' },
    emptyListText: { fontSize: 14, color: C.textLow },

    // ── Detail view ───────────────────────────────────────────────────────────
    backHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.border,
        backgroundColor: C.card,
    },
    backHeaderEn: { fontSize: 16, fontFamily: 'Nunito-Bold', color: C.textHigh },
    backHeaderKo: { fontSize: 11, color: C.textMid, marginTop: 1 },

    scroll: { flex: 1 },

    stationHeader: {
        paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: C.border,
    },
    stationNameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
    stationNamePills: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    stationNameEn: { fontSize: 24, fontFamily: 'Nunito-Bold', color: C.textHigh },
    stationNameKo: { fontSize: 13, color: C.textMid, marginTop: 4 },
    pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
    pillText: { color: '#fff', fontSize: 11, fontFamily: 'Nunito-ExtraBold' },


    // Facilities summary icon bar
    iconBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 14, paddingHorizontal: 6,
        borderBottomWidth: 1, borderBottomColor: C.border,
        backgroundColor: '#F0F0F5',
    },
    iconItem: { alignItems: 'center', width: 50 },
    summaryIconBg: {
        width: 22, height: 22,
        borderRadius: 5,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 4,
    },
    iconItemDim: { opacity: 0.3 },
    iconLabel: { fontSize: 11, fontFamily: 'Nunito-Bold', color: C.textHigh },
    iconLabelDim: { color: C.textLow },

    // Loading
    facilityLoading: { paddingVertical: 40, alignItems: 'center', gap: 10 },
    facilityLoadingText: { color: C.textMid, fontSize: 13 },

    // Accordion sections
    section: {},
    sectionSep: { height: StyleSheet.hairlineWidth, backgroundColor: C.border, marginHorizontal: 20 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center',
        paddingLeft: 20, paddingRight: 20, paddingVertical: 14,
    },
    sectionHeaderIconWrap: { width: 28, alignItems: 'center', marginRight: 18 },
    headerIconBg: {
        width: 28, height: 28,
        borderRadius: 6,
        justifyContent: 'center', alignItems: 'center',
    },
    sectionHeaderTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    sectionTitle: { fontSize: 16, fontFamily: 'Nunito-Bold', color: C.textHigh },
    sectionSubTitle: { fontSize: 11, color: C.textMid },
    sectionBody: { paddingLeft: 20, paddingRight: 20, paddingBottom: 16 },

    // Line group header
    lineGroupHeader: { paddingTop: 10, paddingBottom: 4, alignItems: 'flex-start' },

    // Facility items
    facilityItem: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, minHeight: 56,
        borderBottomWidth: 0.5, borderBottomColor: C.border,
    },
    facilityItemIconCol: { width: 36, alignItems: 'center' },
    facilityItemContent: { flex: 1, marginRight: 8 },
    facilityItemTitleRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    facilityItemMain: { fontSize: 15, fontFamily: 'Nunito-Bold', color: C.textHigh, flexShrink: 1 },
    facilityItemSub: { fontSize: 12, color: C.textMid, marginTop: 2 },

    // Mini tags
    miniTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
    miniTagText: { fontSize: 10, fontWeight: '800' },
    miniTagPurple: { backgroundColor: '#EDE7F6' },
    miniTagTextPurple: { color: '#4527A0' },
    miniTagAmber: { backgroundColor: '#FFD500' },
    miniTagTextAmber: { color: '#000000' },
    miniTagGreen: { borderColor: '#66BB6A', backgroundColor: '#E8F5E9' },
    miniTagTextGreen: { color: '#1B5E20' },
    miniTagOrange: { borderColor: '#FFA726', backgroundColor: '#FFF3E0' },
    miniTagTextOrange: { color: '#BF360C' },

    // Dot status indicator
    statusDotWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusDotEn: { fontSize: 11, fontFamily: 'Nunito-Bold', lineHeight: 13 },
    statusDotKo: { fontSize: 9, lineHeight: 11, color: C.textMid },

    // Not available
    notAvailableWrap: { paddingVertical: 8 },
    notAvailableEn: { fontSize: 13, fontWeight: '600', color: C.textMid },
    notAvailableKo: { fontSize: 11, color: C.textLow, marginTop: 2 },

    // Station info chips
    infoChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    infoChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    infoChipGreen:  { backgroundColor: '#E8F5E9', borderColor: '#66BB6A' },
    infoChipOrange: { backgroundColor: '#FFF3E0', borderColor: '#FFA726' },
    infoChipText: { fontSize: 11, fontFamily: 'Nunito-Bold' },
});
