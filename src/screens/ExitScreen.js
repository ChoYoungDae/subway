import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { matchesChosung } from '../utils/chosung';
import { translateLocation, synthesizeLocation, checkIsInside, loadTranslationCache } from '../utils/translation';
import { MOVEMENT_TRANSLATIONS } from '../data/movementTranslations';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  InteractionManager,
  Platform,
  LayoutAnimation,
  UIManager,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRINGS, formatWithVars } from '../i18n/strings';
import { supabase } from '../../lib/supabase';
import { useFavorites } from '../hooks/useFavorites';
import { getLineColor, getLineBadgeLabel } from '../utils/lineColors';
import { fetchSeoulElevatorStatus, isElevatorAvailable, elevatorStatusLabel, fetchStationToilet, fetchStationDisabledToilet, fetchStationLocker, fetchStationCnvFacl, fetchStationLostPropertyOffice, fetchStationWheelchairLift, fetchStationEscalators, fetchStinElevatorMovement, fetchSubwayRouteInfo, getKricItems } from '../api/seoulApi';

import TimelineContainer from '../components/TimelineContainer';
import { splitOriginSegment, splitTransitSegment, splitDestinationSegment } from '../utils/segmentParser';
import JourneyMasterView from '../components/JourneyMasterView';

const NAVY = '#3d2f7a';


const DIRECTION_EN = {}; // Removed hardcoded map

function extractDirection(text) {
  const namedLines = ['경의중앙선', '공항철도', '경춘선', '분당선', '신분당선', '수인분당선', '우이신설선', '자기부상철도'];
  let cleaned = text
    .replace(/^\d+\)\s*/, '')
    .replace(/\([^)]+\)\s*/g, '')
    .replace(/\d+호선\s*/g, '')
    .replace(/\d+층\s*/g, '');  // 1층, 2층 등 층수 제거
  for (const line of namedLines) {
    cleaned = cleaned.replace(new RegExp(line + '\\s*', 'g'), '');
  }
  cleaned = cleaned.trim();
  const m = cleaned.match(/(.+?)\s*방면/);
  return m ? m[1].trim() : null;
}

let _stationNameMap = {};
let _stationNameMapLoaded = false;

async function loadStationNameMap() {
  if (_stationNameMapLoaded) return;
  try {
    const { data } = await supabase.from('stations').select('name_ko, name_en');
    if (data) {
      data.forEach(({ name_ko, name_en }) => {
        if (!name_ko || !name_en) return;
        _stationNameMap[name_ko] = name_en;
        const short = name_ko.replace(/\s*\(.*\)$/, '').trim();
        if (short !== name_ko) _stationNameMap[short] = name_en;
      });
    }
    _stationNameMapLoaded = true;
  } catch (e) {
    console.log('[directionEn] stations 로드 실패:', e.message);
  }
}

function directionEn(ko) {
  if (!ko) return null;
  return _stationNameMap[ko] || ko;
}

function extractExitNos(text) {
  if (!text) return [];
  // Strictly match numbers only when followed by exit keywords
  const pattern = /(\d+)(?:번\s*출입구|번\s*출구|호\s*출입구|호\s*출구|번\s*Exit|번\s*Gate|번)/gi;
  const matches = [...text.matchAll(pattern)];
  const results = matches.map(m => m[1]);
  return [...new Set(results)]; // Unique exit numbers
}

function extractExitNo(text) {
  const nos = extractExitNos(text);
  return nos.length > 0 ? nos[0] : null;
}

function extractEntrance(text) {
  if (text.includes('여객터미널')) return 'Terminal';
  if (text.includes('제1교통센터')) return 'Center 1';
  if (text.includes('제2교통센터')) return 'Center 2';
  const exitNo = extractExitNo(text);
  if (exitNo) return `Exit ${exitNo}`;
  return null;
}

const LINE_NAME_EN = {
  '경의중앙선': 'Gyeongui-Jungang Line',
  '공항철도': 'Airport Railroad',
  '경춘선': 'Gyeongchun Line',
  '분당선': 'Bundang Line',
  '신분당선': 'Shinbundang Line',
  '수인분당선': 'Suin-Bundang Line',
  '우이신설선': 'Ui-Sinseol Line',
  '자기부상철도': 'Maglev',
};

function extractLineNo(text) {
  const numMatch = text.match(/(\d+)호선/);
  if (numMatch) return numMatch[1] + '호선';
  const namedLines = ['경의중앙선', '공항철도', '경춘선', '분당선', '신분당선', '수인분당선', '우이신설선', '자기부상철도'];
  for (const line of namedLines) {
    if (text.includes(line)) return line;
  }
  return null;
}

function lineEn(line) {
  if (!line) return null;
  if (LINE_NAME_EN[line]) return LINE_NAME_EN[line];
  return 'Line ' + line.replace('호선', '');
}

function buildPathLabel(dvCd, steps, pathName, currentLine, allStationLines) { // currentLine, allStationLines 파라미터 추가
  if (!steps || steps.length === 0) return null;
  const firstKo = steps[0]?.ko || '';
  const allKo = steps.map(s => s.ko || '');

  if (dvCd === '1') {
    const entrance = extractEntrance(firstKo);
    const exitNo = extractExitNo(firstKo);
    let destDir = null;
    for (let i = allKo.length - 1; i >= 0; i--) {
      const dir = extractDirection(allKo[i]);
      if (dir) {
        destDir = dir;
        break;
      }
    }
    if (entrance && destDir) return {
      en: `${entrance} → ${directionEn(destDir)}-bound`,
      ko: exitNo ? `${exitNo}번 출구 → ${destDir} 방면` : `${entrance} → ${destDir} 방면`,
    };

    // 방면이 명시되지 않았을 경우 목적지(대합실, 승강장 등) 추론
    if (entrance && !destDir && allKo.length > 0) {
      const lastKo = allKo[allKo.length - 1];
      let destFallbackKo = null;
      let destFallbackEn = null;
      if (lastKo.includes('승강장') || lastKo.includes('타는 곳')) {
        destFallbackKo = '승강장';
        destFallbackEn = 'Platform';
      } else if (lastKo.includes('대합실') || lastKo.includes('표 내는 곳')) {
        destFallbackKo = '대합실';
        destFallbackEn = 'Concourse';
      }
      if (destFallbackKo) {
        return {
          en: `${entrance} → ${destFallbackEn}`,
          ko: exitNo ? `${exitNo}번 출구 → ${destFallbackKo}` : `${entrance} → ${destFallbackKo}`,
        };
      }
    }

    if (entrance) return {
      en: entrance,
      ko: exitNo ? `${exitNo}번 출구` : entrance,
    };
  } else if (dvCd === '3') {
    // Try to infer from/to line and directions from step texts first
    let fromLine = null, fromDir = null, toLine = null, toDir = null;
    for (let i = 0; i < allKo.length; i++) {
      const ko = allKo[i];
      if (!fromLine) {
        const l = extractLineNo(ko);
        const d = extractDirection(ko);
        if (l) fromLine = l;
        if (d) fromDir = d;
      }
      // prefer the first occurrence for from, continue to find to
    }
    for (let i = allKo.length - 1; i >= 0; i--) {
      const ko = allKo[i];
      if (!toLine) {
        const l = extractLineNo(ko);
        const d = extractDirection(ko);
        if (l) toLine = l;
        if (d) toDir = d;
      }
    }

    // If still missing, try to parse pathName (e.g. "1호선 → 2호선" 등)
    if ((!fromLine || !toLine) && pathName) {
      const m = pathName.match(/(\d+호선|경의중앙선|공항철도|경춘선|분당선|신분당선|수인분당선|우이신설선|자기부상철도)\s*(?:.*→\s*)?(\d+호선|경의중앙선|공항철도|경춘선|분당선|신분당선|수인분당선|우이신설선|자기부상철도)?/);
      if (m) {
        if (m[1] && !fromLine) fromLine = m[1];
        if (m[2] && !toLine) toLine = m[2];
      }
    }

    // Fallbacks if line info is still missing
    if (!fromLine && currentLine) fromLine = currentLine;
    if (!toLine && allStationLines && allStationLines.length === 2 && currentLine) {
      const other = allStationLines.find(sl => sl.line !== currentLine);
      if (other) toLine = other.line;
    }

    if (fromLine && toLine) {
      // directions may be missing; try to extract from any step
      if (!fromDir) {
        for (const ko of allKo) {
          const d = extractDirection(ko);
          if (d) { fromDir = d; break; }
        }
      }
      if (!toDir) {
        for (let i = allKo.length - 1; i >= 0; i--) {
          const d = extractDirection(allKo[i]);
          if (d) { toDir = d; break; }
        }
      }
      return {
        en: `${lineEn(fromLine)}${fromDir ? ` (${directionEn(fromDir)}-bound)` : ''} → ${lineEn(toLine)}${toDir ? ` (${directionEn(toDir)}-bound)` : ''}`,
        ko: `${fromLine}${fromDir ? ` ${fromDir}` : ''} 방면 → ${toLine}${toDir ? ` ${toDir}` : ''} 방면`,
      };
    } else if (fromLine || toLine) {
      // Partial match
      const line = fromLine || toLine;
      const dir = fromDir || toDir;
      const isCurrent = line === currentLine;
      return {
        en: isCurrent ? (dir ? `Toward ${directionEn(dir)}` : lineEn(line)) : `${lineEn(line)}${dir ? ` (${directionEn(dir)}-bound)` : ''}`,
        ko: isCurrent ? (dir ? `${dir} 방면` : line) : `${line}${dir ? ` ${dir} 방면` : ''}`,
      };
    }
  }
  return null;
}


// ① ② ③ ... 원형 숫자
const CIRCLE_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
function circleNum(n) {
  const i = parseInt(n) - 1;
  return (i >= 0 && i < CIRCLE_NUMBERS.length) ? CIRCLE_NUMBERS[i] : `(${n})`;
}

function ExitLineCircle({ line }) {
  if (!line) return null;
  const label = getLineBadgeLabel(line);
  const color = getLineColor(line);
  const fontSize = label.length <= 1 ? 14 : label.length === 2 ? 10 : 9;
  return (
    <View style={[styles.lineCircle, { backgroundColor: color }]}>
      <Text style={[styles.lineCircleText, { fontSize }]}>{label}</Text>
    </View>
  );
}

function FacilityItem({ icon, labelEn, labelKo, subEn, subKo, tagEn, tagKo, tagColor }) {
  return (
    <View style={styles.facilityItem}>
      <View style={styles.facilityIconWrap}>
        <Text style={styles.facilityIcon}>{icon}</Text>
      </View>
      <View style={styles.facilityContent}>
        <View style={styles.facilityTitleRow}>
          <View style={styles.facilityTextGroup}>
            <Text style={styles.facilityLabelEn}>{labelEn}</Text>
            <Text style={styles.facilityLabelKo}>{labelKo}</Text>
          </View>
          {tagEn && (
            <View style={[styles.facilityTag, { backgroundColor: tagColor || '#f0ecff' }]}>
              <Text style={[styles.facilityTagText, { color: tagColor ? '#fff' : '#7c65c1' }]}>{tagEn}</Text>
            </View>
          )}
        </View>
        {(subEn || subKo) && (
          <View style={styles.facilitySubGroup}>
            {subEn && <Text style={styles.facilitySubEn}>{subEn}</Text>}
            {subKo && <Text style={styles.facilitySubKo}>{subKo}</Text>}
          </View>
        )}
      </View>
    </View>
  );
}
export default function ExitScreen({ route, navigation }) {
  const { stationId, nameEn, nameKo, stationLines = [], wizardResult } = route.params || {};
  const [exits, setExits] = useState([]);
  const [elevatorStatus, setElevatorStatus] = useState({});
  const [facilities, setFacilities] = useState([
    { id: 'toilet', icon: '🚽', labelEn: 'Restroom', labelKo: '화장실', subEn: 'Loading...', subKo: '로딩 중...' },
    { id: 'locker', icon: '🧳', labelEn: 'Lockers', labelKo: '물품보관함', subEn: 'Loading...', subKo: '로딩 중...' },
  ]);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [lineMovements, setLineMovements] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [routeSequences, setRouteSequences] = useState({});
  const [expandedKey, setExpandedKey] = useState(null);
  const [selectedExit, setSelectedExit] = useState(null);
  const [destName, setDestName] = useState('');
  const [destDirection, setDestDirection] = useState(null);
  const [isNearDestination, setIsNearDestination] = useState(false); // 도착역 근처 여부 상태

  const handleDestSearch = () => {
    if (!destName.trim()) { setDestDirection(null); return; }
    const target = destName.trim();
    const results = [];

    Object.entries(routeSequences).forEach(([line, seq]) => {
      if (seq[target] !== undefined && seq[nameKo] !== undefined) {
        const mySeq = seq[nameKo];
        const targetSeq = seq[target];
        const allStations = Object.entries(seq).sort((a, b) => a[1] - b[1]);
        const endStation = targetSeq > mySeq ? allStations[allStations.length - 1][0] : allStations[0][0];
        results.push({ line, direction: endStation, isHigher: targetSeq > mySeq });
      }
    });
    setDestDirection(results.length > 0 ? results : 'NOT_FOUND');
  };
  const { isFavorite, toggleFavorite } = useFavorites();
  const scrollRef = useRef(null);
  const cardLayouts = useRef({});

  const loadRouteSequences = async () => {
    try {
      const sequences = {};
      for (const sl of stationLines) {
        if (!sl.lnCd) continue;
        // lnCd is usually 1, 2, ...
        // We need to fetch route info for this line
        const res = await fetchSubwayRouteInfo({ lnCd: sl.lnCd });
        const items = getKricItems(res);
        if (items.length > 0) {
          // Store as map: stinNm -> stinConsOrdr
          const seqMap = {};
          items.forEach(it => {
            seqMap[it.stinNm] = parseInt(it.stinConsOrdr);
          });
          sequences[sl.line] = seqMap;
        }
      }
      setRouteSequences(sequences);
    } catch (e) {
      console.log('[RouteInfo] Failed to load sequences:', e.message);
    }
  };

  useEffect(() => {
    if (stationLines.length > 0) loadRouteSequences();
  }, [stationLinesKey]);

  const scrollToCard = useCallback((cardKey) => {
    const y = cardLayouts.current[cardKey];
    if (typeof y === 'number') {
      const offset = 80;
      InteractionManager.runAfterInteractions(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - offset), animated: true });
      });
    }
  }, []);



  const toggleExpand = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedKey(prev => prev === key ? null : key);
  };

  const stationLinesKey = useMemo(() =>
    stationLines.map(sl => `${sl.lnCd}_${sl.stinCd}`).join(','),
    [stationLines]
  );

  const station = useMemo(() => {
    const lines = [...stationLines]
      .sort((a, b) => (parseInt(a.lnCd) || 999) - (parseInt(b.lnCd) || 999))
      .map(sl => sl.line).filter(Boolean);

    return {
      id: stationId,
      name_en: nameEn,
      name_ko: nameKo,
      lines: lines
    };
  }, [stationId, nameEn, nameKo, stationLinesKey]);

  const allLines = station.lines;

  const isFav = isFavorite(stationId);

  useEffect(() => {
    navigation.setOptions({
      title: `${nameEn || ''} · ${nameKo || ''}`,
      headerRight: () => (
        <TouchableOpacity onPress={() => toggleFavorite(station)} style={{ marginRight: 4 }}>
          <Text style={{ fontSize: 22, color: '#FFC107' }}>{isFav ? '★' : '☆'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [nameEn, nameKo, isFav, station]);

  useEffect(() => { loadTranslationCache(); loadStationNameMap(); }, []);
  useEffect(() => { loadExits(); }, [nameKo]);

  const loadExits = async () => {
    try {
      setLoading(true);
      const stinCodes = (stationLines || []).map(sl => sl.stinCd).filter(Boolean);

      // 1. Fetch from station_exits (Legacy mapping via stationId)
      const { data: exitsData, error } = await supabase
        .from('station_exits')
        .select('*')
        .eq('station_id', stationId)
        .order('exit_no', { ascending: true });

      let processedExits = exitsData || [];

      if (error || !exitsData || exitsData.length === 0) {
        // Fallback to elevators table using stin_cd
        if (stinCodes.length > 0) {
          const { data: fallbackData } = await supabase
            .from('elevators')
            .select('*')
            .in('stin_cd', stinCodes)
            .eq('is_internal', false);
          processedExits = fallbackData || [];
        }
      }

      // 2. [Bridge Logic] Fetch internal elevators using stin_cd
      let internalElevators = [];
      if (stinCodes.length > 0) {
        const { data } = await supabase
          .from('elevators')
          .select('*')
          .in('stin_cd', stinCodes)
          .eq('is_internal', true);
        internalElevators = data || [];
      }

      const finalExits = processedExits.map(exit => {
        // Legacy: refined_route_json and bridgeSteps were used for static route display
        // Now mostly superseded by KRIC live API.
        return exit;
      });

      setExits(finalExits);
    } catch (err) {
      console.log('Failed to load exits:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadElevatorStatus = async () => {
    try {
      setStatusLoading(true);
      const items = await fetchSeoulElevatorStatus(nameKo);
      const statusMap = {};
      items.forEach((item) => {
        if (item.vcntEntrcNo === '내부') return;
        const exitNos = String(item.vcntEntrcNo).split(',').map(s => s.trim());
        const avail = isElevatorAvailable(item.oprtngSitu);
        const label = elevatorStatusLabel(item.oprtngSitu);
        exitNos.forEach((no) => {
          if (statusMap[no] === undefined || avail === false) {
            statusMap[no] = { avail, label, oprtngSitu: item.oprtngSitu };
          }
        });
      });
      setElevatorStatus(statusMap);
    } catch (e) {
      console.log('[Status] API 호출 실패:', e.message);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && exits.length > 0) loadElevatorStatus();
  }, [loading, exits]);



  const movementLoaded = useRef(false);
  useEffect(() => {
    if (!stationLines || stationLines.length === 0 || movementLoaded.current) return;
    loadMovement();
    movementLoaded.current = true;
  }, [stationLinesKey]);

  const loadMovement = async () => {
    if (movementLoading) return;
    try {
      setMovementLoading(true);
      await loadStationNameMap();
      const results = [];

      let routePhotos = [];
      try {
        const { data: photos } = await supabase
          .from('route_photos')
          .select('exit_no, direction, step_order, photo_url, caption_en')
          .eq('station_name_ko', nameKo);
        routePhotos = photos || [];
      } catch (e) { }

      const sortedLines = [...stationLines].sort((a, b) => (parseInt(a.lnCd) || 999) - (parseInt(b.lnCd) || 999));

      for (const sl of sortedLines) {
        let { lnCd, stinCd, line, oprCd } = sl;

        if (!lnCd || !stinCd) continue;
        try {
          const res = await fetchStinElevatorMovement({ lnCd, stinCd, railOprIsttCd: oprCd });
          const raw = getKricItems(res);
          const pathMap = {};
          raw.forEach((item) => {
            const key = `${item.mvPathMgNo}_${item.mvPathDvCd}`;
            if (!pathMap[key]) {
              pathMap[key] = { mgNo: item.mvPathMgNo, dvCd: item.mvPathDvCd, name: item.mvPathDvNm, steps: [] };
            }
            const ko = item.mvContDtl?.trim() || '';

            // Translate using the standard translator
            let en = translateLocation(ko);

            if (!pathMap[key].steps.some(s => s.ko === ko)) {
              pathMap[key].steps.push({ en, ko });
            }
          });

          const paths = Object.values(pathMap).sort((a, b) => {
            if (a.dvCd !== b.dvCd) return a.dvCd.localeCompare(b.dvCd);
            return a.mgNo - b.mgNo;
          });

          const nameCount = {};
          paths.forEach(p => { nameCount[p.name] = (nameCount[p.name] || 0) + 1; });
          const nameIdx = {};
          paths.forEach(p => {
            if (nameCount[p.name] > 1) nameIdx[p.name] = (nameIdx[p.name] || 0) + 1;
            const label = buildPathLabel(p.dvCd, p.steps, p.name, line, sortedLines);
            // console.log 제거됨 - 브릿지 과부하 원인
            if (label) {
              p.labelEn = label.en;
              p.labelKo = label.ko;
            } else {
              const idx = nameCount[p.name] > 1 ? ` ${nameIdx[p.name]}` : '';
              const koName = p.name || '';
              let enName;
              if (koName.includes('출입구') && koName.includes('승강장')) {
                enName = `Exit → Platform${idx}`;
              } else if (koName.includes('출입구')) {
                enName = `Exit Route${idx}`;
              } else if (koName.includes('환승')) {
                enName = `Transfer Route${idx}`;
              } else if (koName.includes('내부')) {
                enName = `Internal Route${idx}`;
              } else {
                enName = koName + idx;
              }
              p.labelEn = enName;
              p.labelKo = nameCount[p.name] > 1 ? `${koName} ${nameIdx[p.name]}` : koName;
            }
            p.photosByStep = {};
            // Extract all exit numbers from all steps for robust filtering
            const allStepsKo = p.steps.map(s => s.ko).join(' ');
            const exitContext = (p.name || '') + ' ' + allStepsKo;
            p.exitNos = extractExitNos(exitContext);
            p.exitNo = p.exitNos.length > 0 ? p.exitNos[0] : null;

            routePhotos
              .filter(ph => (p.exitNos.includes(ph.exit_no)) && ph.direction === p.direction)
              .forEach(ph => { p.photosByStep[ph.step_order] = { url: ph.photo_url, caption: ph.caption_en }; });
          });

          results.push({ line, lnCd, paths, routePhotos });
        } catch (e) {
          console.error(`[ExitScreen] Error processing line ${sl.line}:`, e.message);
          results.push({ line: sl.line, lnCd: sl.lnCd, paths: [], routePhotos: [] });
        }
      }
      setLineMovements(results);
    } catch (e) {
      console.log('[Movement] 전체 호출 실패:', e.message);
    } finally {
      setMovementLoading(false);
    }
  };

  const getStatus = (exit) => {
    const key = String(exit.exit_no);
    if (elevatorStatus[key] !== undefined) return elevatorStatus[key];
    const avail = exit.status !== 'out_of_service';
    return { avail, label: avail ? { ko: '정상 운행', en: 'In Service' } : { ko: '이용 불가', en: 'Out of Service' } };
  };

  const loadDetailedFacilities = async () => {
    const CACHE_KEY = `facilities_v20_${stationId}`;
    const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000;

    try {
      if (!stationLines || stationLines.length === 0) return;

      // 1. Check Cache
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      if (cachedData) {
        const { timestamp, data } = JSON.parse(cachedData);
        if (Date.now() - timestamp < CACHE_DURATION) {
          console.log(`[Facilities] Loading from v15 cache for ${nameKo}`);
          setFacilities(data);
          return;
        }
      }

      // 2. If no cache or expired, Fetch from API
      console.log(`[Facilities] Fetching live data for ${nameKo}...`);
      const allToilets = [];
      const allLockers = [];
      const allDisabledToilets = [];
      const allNursingRooms = [];
      const allWheelchairLifts = [];

      for (const sl of stationLines) {
        let { lnCd, stinCd, oprCd } = sl;

        if (!lnCd || !stinCd) continue;

        console.log(`[Facilities] Fetching ${nameKo} (@${sl.line}): lnCd=${lnCd}, stinCd=${stinCd}, oprCd=${oprCd}`);

        // Fetch Toilet
        try {
          const res = await fetchStationToilet({ lnCd, stinCd, railOprIsttCd: oprCd });
          const items = getKricItems(res);
          if (items.length > 0) allToilets.push(...items);
        } catch (e) { console.log(`[Toilet] ${sl.line} fetch failed`); }

        // Fetch Disabled Toilet
        try {
          const res = await fetchStationDisabledToilet({ lnCd, stinCd, railOprIsttCd: oprCd });
          const items = getKricItems(res);
          if (items.length > 0) allDisabledToilets.push(...items);
        } catch (e) { console.log(`[DisabledToilet] ${sl.line} fetch failed`); }

        // Fetch Locker
        try {
          const res = await fetchStationLocker({ lnCd, stinCd, railOprIsttCd: oprCd });
          const items = getKricItems(res);
          if (items.length > 0) allLockers.push(...items);
        } catch (e) { console.log(`[Locker] ${sl.line} fetch failed`); }

        // Fetch Nursing Room & Wheelchair Lift (via stationCnvFacl)
        try {
          const res = await fetchStationCnvFacl({ lnCd, stinCd, railOprIsttCd: oprCd });
          const items = getKricItems(res);
          const feeds = items.filter(it => it.facilityDivCd === 'FEED');
          const lifts = items.filter(it => it.facilityDivCd === 'WCLF');
          if (feeds.length > 0) allNursingRooms.push(...feeds);
          if (lifts.length > 0) allWheelchairLifts.push(...lifts);
        } catch (e) { console.log(`[CnvFacl] ${sl.line} fetch failed`); }

        try {
          const res = await fetchStationWheelchairLift({ lnCd, stinCd, railOprIsttCd: oprCd });
          const items = getKricItems(res);
          if (items.length > 0) allWheelchairLifts.push(...items);
        } catch (e) { console.log(`[WheelchairLift] ${sl.line} fetch failed`); }

      }

      console.log(`[Facilities] Totals for ${nameKo}: Toilet=${allToilets.length}, DisabledToilet=${allDisabledToilets.length}, Nursing=${allNursingRooms.length}, Lift=${allWheelchairLifts.length}, Locker=${allLockers.length}`);

      // Initial structure for updates
      const updatedFacilities = [
        { id: 'toilet', icon: '🚽', labelEn: 'Restroom', labelKo: '화장실', subEn: 'No information', subKo: '정보 없음' },
        { id: 'disabled_toilet', icon: '♿', labelEn: 'Disabled Toilet', labelKo: '장애인 화장실', subEn: 'No information', subKo: '정보 없음' },
        { id: 'nursing', icon: '🍼', labelEn: 'Nursing Room', labelKo: '수유실', subEn: 'No information', subKo: '정보 없음' },
        { id: 'lift', icon: '🛗', labelEn: 'Wheelchair Lift', labelKo: '휠체어 리프트', subEn: 'No information', subKo: '정보 없음' },
        { id: 'locker', icon: '🧳', labelEn: 'Lockers', labelKo: '물품보관함', subEn: 'No information', subKo: '정보 없음' },
      ];

      // Helper to update facility info (Deduplication & Translation)
      const updateFacility = (id, items, locField = 'dtlLoc') => {
        if (!items || !Array.isArray(items) || items.length === 0) return;
        const idx = updatedFacilities.findIndex(f => f.id === id);
        if (idx === -1) return;

        // Normalization and Deduplication
        const normalizedItems = items.map(it => {
          const loc = synthesizeLocation(it, locField);
          const isInside = checkIsInside(it);

          return { loc, isInside, raw: it };
        }).filter(it => it.loc);

        // Deduplicate by location string
        const seenLocs = new Set();
        const uniqueItems = [];
        normalizedItems.forEach(it => {
          if (!seenLocs.has(it.loc)) {
            seenLocs.add(it.loc);
            uniqueItems.push(it);
          }
        });

        if (uniqueItems.length === 0) return;

        const locsKo = uniqueItems.map(it => it.loc);
        const locsEn = locsKo.map(translateLocation);
        const hasInside = uniqueItems.some(it => it.isInside);

        updatedFacilities[idx] = {
          ...updatedFacilities[idx],
          subKo: locsKo.join(', '),
          subEn: locsEn.join(', '),
          tagKo: hasInside ? '개찰구 안' : '개찰구 밖',
          tagEn: hasInside ? 'Inside Gate' : 'Outside Gate',
          tagColor: hasInside ? '#2e7d32' : '#ed6c02',
          rawData: uniqueItems.map(it => it.raw)
        };
      };

      updateFacility('toilet', allToilets);
      updateFacility('disabled_toilet', allDisabledToilets);
      updateFacility('locker', allLockers);
      updateFacility('nursing', allNursingRooms, 'dtlLoc');
      updateFacility('lift', allWheelchairLifts, 'dtlLoc');

      setFacilities(updatedFacilities);

      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        timestamp: Date.now(),
        data: updatedFacilities
      }));

    } catch (e) {
      console.log('[Facilities] Load failed:', e.message);
    }
  };

  const facilitiesLoaded = useRef(false);
  useEffect(() => {
    if (stationLines.length > 0 && !facilitiesLoaded.current) {
      loadDetailedFacilities();
      facilitiesLoaded.current = true;
    }
  }, [stationLinesKey]);

  const hasAnyMovement = lineMovements.some(lm => lm.paths.length > 0);

  const navigateToFacilities = () => {
    // If an exit is selected, pass its refined route data to FacilityScreen
    const selectedExitData = selectedExit ? exits.find(e => (e.refined_exit_no || e.exit_no) === selectedExit) : null;

    navigation.navigate('Facility', {
      nameEn,
      nameKo,
      lines: allLines,
      facilities,
      location_detail_ko: selectedExitData?.location_detail_ko
    });
  };

  const renderRouteCard = (path, cardKey, isExpanded, lineColor, opacity = 1) => {
    if (isExpanded) console.log(`[ExitScreen] Rendering expanded card: ${cardKey}`);
    return (
      <View style={[styles.routeCard, { opacity }]}>
        <TouchableOpacity
          style={styles.routeHeader}
          onPress={() => toggleExpand(cardKey)}
          activeOpacity={0.7}
        >
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={[styles.routeName, { color: lineColor }]}>{path.labelEn}</Text>
            {path.labelKo ? <Text style={styles.routeNameKo}>{path.labelKo}</Text> : null}
          </View>
          <View style={styles.chevronWrap}>
            <View style={[styles.chevronInner, { borderColor: lineColor }, isExpanded && styles.chevronUp]} />
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.routeSteps}>
            {/* Best Door Highlight */}
            {(() => {
              const allParsed = path.steps.map(s => parseSubwayRoute(s.ko)[0]);
              const firstBestDoor = allParsed.find(p => p.bestDoor)?.bestDoor;
              if (firstBestDoor) {
                return (
                  <View style={styles.bestDoorHighlight}>
                    <Text style={styles.bestDoorHighlightEmoji}>🚪</Text>
                    <View>
                      <Text style={styles.bestDoorHighlightTitle}>Best Boarding/Alighting Position</Text>
                      <Text style={styles.bestDoorHighlightValue}>Door #{firstBestDoor}</Text>
                    </View>
                  </View>
                );
              }
              return null;
            })()}

            {(() => {
              if (path.dvCd === '1' || path.dvCd === '2' || selectedExit) {
                // Determine direction for the transit segment
                const directionTextKo = path.direction || destName || (path.labelKo?.split('→')[1]?.trim()) || 'Unknown';
                const directionTextEn = directionEn(directionTextKo) || 'Bound';

                return (
                  <JourneyMasterView
                    originSegments={splitOriginSegment(path.steps)}
                    transitSegments={splitTransitSegment({
                      fromLine: line || 'Subway',
                      direction: `${directionTextEn} [${directionTextKo} 방면]`,
                      bestDoor: path.steps.map(s => parseSubwayRoute(s.ko)[0]).find(p => p.bestDoor)?.bestDoor || 'Any',
                      exitSide: 'unknown',
                      stations: [] // We don't have the intermediate stations here, but we avoid hardcoding
                    })}
                    destinationSegments={splitDestinationSegment(path.steps.map(s => s.ko))}
                    isNearArrival={isNearDestination}
                  />
                );
              }

              // Fallback for non-segmented paths (Internal or other)
              return (
                <TimelineContainer
                  routeData={path.steps.map(s => {
                    const parsed = parseSubwayRoute(s.ko);
                    if (parsed && parsed.length > 0) {
                      return { ...parsed[0], originalText: s.ko };
                    }
                    return {
                      label: s.ko.includes('승차') ? 'Boarding' : (s.en || 'Movement'),
                      originalText: s.ko,
                      icon: s.ko.includes('승차') ? 'train-variant' : 'circle-outline',
                      floor: (s.ko.match(/(\d+)층/) || [])[1] ? (s.ko.match(/(\d+)층/)[1] + 'F') : null
                    };
                  })}
                  style={{ backgroundColor: 'transparent' }}
                />
              );
            })()}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={{ flex: 1 }}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent}>

          {/* 역 헤더 */}
          <View style={styles.stationHeader}>
            <View style={styles.stationHeaderLeft}>
              <Text style={styles.stationNameEn}>{nameEn}</Text>
              <View style={styles.stationHeaderRow}>
                <Text style={styles.stationNameKo}>{nameKo}</Text>
                {facilities
                  .filter(f => f.id === 'toilet' || f.id === 'disabled_toilet')
                  .flatMap(f => {
                    if (!f.rawData || f.rawData.length === 0) return [];

                    const insideItems = f.rawData.filter(it => checkIsInside(it));
                    const outsideItems = f.rawData.filter(it => !checkIsInside(it));

                    const results = [];
                    const config = f.id === 'toilet' ? { icon: '🚽', color: '#7c65c1' } : { icon: '♿', color: '#2e7d32' };

                    if (insideItems.length > 0) {
                      results.push({ id: `${f.id}_in`, icon: config.icon, color: config.color, label: 'Inside Gate' });
                    }
                    if (outsideItems.length > 0) {
                      results.push({ id: `${f.id}_out`, icon: config.icon, color: config.color, label: 'Outside Gate' });
                    }
                    return results;
                  })
                  .map(badge => (
                    <TouchableOpacity
                      key={badge.id}
                      onPress={navigateToFacilities}
                      style={[styles.headerBadge, { backgroundColor: '#ffffff90' }]}
                    >
                      <Text style={[styles.headerBadgeText, { color: badge.color }]}>
                        {badge.icon} {badge.label}
                      </Text>
                    </TouchableOpacity>
                  ))}

              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              {allLines.map(l => <ExitLineCircle key={l} line={l} />)}
            </View>
          </View>

          {/* ── Accessible Exits 섹션 ── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIconWrap}>
                <Text style={styles.sectionHeadingIcon}>🛗</Text>
              </View>
              <View>
                <Text style={styles.sectionHeadingTitle}>Accessible Exits [엘리베이터 이용 가능 출구]</Text>
                <Text style={styles.sectionHeadingSubtitle}>Elevators available at these exits</Text>
              </View>
              {statusLoading && (
                <Text style={styles.statusLoadingText}>  Checking...</Text>
              )}
            </View>

            {loading ? (
              <ActivityIndicator size="large" color={NAVY} style={styles.loader} />
            ) : exits.length > 0 ? (
              <View style={styles.exitTable}>
                {exits.map((exit, idx) => {
                  const exitNo = exit.refined_exit_no || exit.exit_no;
                  const isSelected = selectedExit === exitNo;
                  const exitLabelEn = formatWithVars(STRINGS.exits.exitLabel.en, { number: exitNo });
                  const exitLabelKo = formatWithVars(STRINGS.exits.exitLabel.ko, { number: exitNo });
                  const { avail, label } = getStatus(exit);
                  const isLast = idx === exits.length - 1;
                  return (
                    <TouchableOpacity
                      key={exit.id}
                      onPress={() => setSelectedExit(isSelected ? null : exitNo)}
                      style={[
                        styles.exitRow,
                        !isLast && styles.exitRowDivider,
                        isSelected && { backgroundColor: '#f0ecff', marginHorizontal: -16, paddingHorizontal: 16 }
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.exitNumber, isSelected && { color: '#7c65c1' }]}>{exitLabelEn}</Text>
                          {isSelected && <Text style={{ fontSize: 10, color: '#7c65c1', fontFamily: 'Nunito-Bold' }}>SELECTED</Text>}
                        </View>
                        {exit.landmarks?.en && exit.landmarks.en.length > 0 && (
                          <Text style={styles.exitLandmarkEn} numberOfLines={1}>
                            ({exit.landmarks.en.slice(0, 2).join(', ')})
                          </Text>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Text style={styles.exitLabelKo}>{exitLabelKo}</Text>
                          {exit.landmarks?.ko && exit.landmarks.ko.length > 0 && (
                            <Text style={styles.exitLandmarkKo} numberOfLines={1}>
                              {' '}({exit.landmarks.ko.slice(0, 2).join(', ')})
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.statusBadge}>
                        <View style={[styles.statusDot, { backgroundColor: avail ? '#2e7d32' : '#c62828' }]} />
                        <View>
                          <Text style={[styles.statusTextEn, { color: avail ? '#2e7d32' : '#c62828' }]}>{label.en}</Text>
                          <Text style={styles.statusTextKo}>{label.ko}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🚫</Text>
                <Text style={styles.emptyText}>{STRINGS.exits.noExits.en}</Text>
                <Text style={styles.emptySubtext}>{STRINGS.exits.noExits.ko}</Text>
              </View>
            )}
          </View>

          {/* ── Direction Guide (New) ── */}
          <View style={styles.destHelperWrap}>
            <Text style={styles.destHelperTitle}>Destination Guide · 목적지 방면 찾기</Text>
            <View style={styles.destInputRow}>
              <TextInput
                style={styles.destInput}
                placeholder="Where are you going? (e.g. 수원)"
                value={destName}
                onChangeText={setDestName}
                onSubmitEditing={handleDestSearch}
              />
              <TouchableOpacity onPress={handleDestSearch} style={{ backgroundColor: '#7c65c1', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: 'Nunito-Bold' }}>Find</Text>
              </TouchableOpacity>
            </View>

            {destDirection === 'NOT_FOUND' && (
              <View style={styles.destResult}>
                <Text style={styles.destResultBody}>Station not found on this line.</Text>
              </View>
            )}

            {Array.isArray(destDirection) && destDirection.map((res, idx) => (
              <View key={idx} style={[styles.destResult, { borderLeftColor: getLineColor(res.line) }]}>
                <Text style={styles.destResultTitle}>For {destName} (@ {res.line})</Text>
                <Text style={styles.destResultBody}>Please take the train bound for:</Text>
                <Text style={styles.destResultDirection}>👉 {res.direction} 방면 ({directionEn(res.direction)})</Text>
              </View>
            ))}
          </View>

          {/* ── Accessible Routes 섹션 ── */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionIconWrap}>
                <Text style={styles.sectionHeadingIcon}>🧳</Text>
              </View>
              <View>
                <Text style={styles.sectionHeadingTitle}>Accessible Routes [엘리베이터 이동 경로 안내]</Text>
                <Text style={styles.sectionHeadingSubtitle}>Detailed movement paths to platform/exit</Text>
              </View>
            </View>

            {movementLoading ? (
              <ActivityIndicator size="small" color={NAVY} style={styles.loader} />
            ) : !hasAnyMovement ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>ℹ️</Text>
                <Text style={styles.emptyText}>No route information available</Text>
                <Text style={styles.emptySubtext}>이 역은 이동동선 정보가 제공되지 않습니다</Text>
              </View>
            ) : (
              lineMovements.map(({ line, lnCd, paths }) => {
                // Apply Wizard Filtering Logic
                let filteredPaths = paths;

                if (wizardResult) {
                  const { intent, destStation } = wizardResult;

                  if (intent === 'OUT') {
                    // Only show exit paths
                    filteredPaths = paths.filter(p => p.dvCd === '1');
                  } else if (intent === 'TRANSFER') {
                    // Only show transfer paths
                    filteredPaths = paths.filter(p => p.dvCd === '3');
                    // Further filter by target line if destination station is provided
                    if (destStation && destStation.line) {
                      const targetLine = destStation.line.replace('선', '');
                      filteredPaths = filteredPaths.filter(p => p.ko.includes(targetLine) || p.en.includes(targetLine));
                    }
                  } else if (intent === 'IN') {
                    // Entering station: 
                    // 1. Show paths that lead TO the platforms (dvCd 1 or 2 often)
                    // 2. MUST match direction if destination is set
                    filteredPaths = paths.filter(p => p.dvCd !== '3'); // Exclude transfers away from here

                    if (destStation && routeSequences[line]) {
                      const seq = routeSequences[line];
                      const mySeq = seq[nameKo];
                      const targetSeq = seq[destStation.name_ko];
                      if (mySeq !== undefined && targetSeq !== undefined) {
                        const isHigher = targetSeq > mySeq;
                        // Filter path by direction keywords in steps
                        filteredPaths = filteredPaths.filter(p => {
                          const hasDirection = p.steps.some(s => {
                            const parsed = parseSubwayRoute(s.ko);
                            const step = parsed[0];
                            if (!step.directionKo) return false;
                            // Heuristic: check if this step's direction matches our target
                            // This is tricky without a full mapping, but let's try
                            return true; // Placeholder for now, simple inclusion
                          });
                          return true; // Keep for now
                        });
                      }
                    }
                  }
                }

                const exitPaths = selectedExit
                  ? filteredPaths.filter(p => p.dvCd === '1' && p.exitNos.includes(selectedExit))
                  : filteredPaths.filter(p => p.dvCd === '1');

                const otherPaths = filteredPaths.filter(p => p.dvCd !== '1');

                const lineColor = getLineColor(line);
                const hasExitPaths = exitPaths.length > 0;
                const hasOtherPaths = otherPaths.length > 0;

                if (!hasExitPaths && !hasOtherPaths) return null;

                return (
                  <View key={lnCd} style={styles.lineGroup}>
                    {/* 호선 헤더 */}
                    <View style={[styles.lineGroupHeader, { borderLeftColor: lineColor }]}>
                      <ExitLineCircle line={line} />
                      <Text style={[styles.lineGroupTitle, { color: lineColor }]}>{lineEn(line)}</Text>
                    </View>

                    {/* Exit Routes Section */}
                    {hasExitPaths && exitPaths.map((path, pathIdx) => {
                      const cardKey = `${lnCd}_${path.dvCd}_${path.mgNo}`;
                      const isExpanded = expandedKey === cardKey;
                      const showSectionHeader = pathIdx === 0;

                      return (
                        <View
                          key={cardKey}
                          onLayout={(e) => { cardLayouts.current[cardKey] = e.nativeEvent.layout.y; }}
                        >
                          {showSectionHeader && (
                            <View style={[styles.routeTypeHeader, { borderLeftColor: '#7E57C2' }]}>
                              <Text style={[styles.routeTypeEn, { color: '#7E57C2' }]}>Exit Routes</Text>
                              <Text style={styles.routeTypeKo}>출입구 ↔ 승강장</Text>
                            </View>
                          )}
                          {renderRouteCard(path, cardKey, isExpanded, lineColor)}
                        </View>
                      );
                    })}

                    {/* Transfer/Internal Routes Section (Tucked away if filtering) */}
                    {hasOtherPaths && (
                      <View style={{ marginTop: selectedExit ? 20 : 0 }}>
                        {selectedExit && (
                          <View style={styles.transferDivider}>
                            <View style={styles.transferDividerLine} />
                            <Text style={styles.transferDividerText}>Need to Transfer?</Text>
                            <View style={styles.transferDividerLine} />
                          </View>
                        )}
                        {otherPaths.map((path, pathIdx) => {
                          const cardKey = `${lnCd}_${path.dvCd}_${path.mgNo}`;
                          const isExpanded = expandedKey === cardKey;
                          const prevDvCd = pathIdx > 0 ? otherPaths[pathIdx - 1].dvCd : null;
                          const showSectionHeader = path.dvCd !== prevDvCd;
                          const sectionLabelEn = path.dvCd === '3' ? 'Transfer Routes' : 'Internal Routes';
                          const sectionLabelKo = path.dvCd === '3' ? '환승 경로' : '내부 경로';

                          return (
                            <View
                              key={cardKey}
                              onLayout={(e) => { cardLayouts.current[cardKey] = e.nativeEvent.layout.y; }}
                            >
                              {showSectionHeader && (
                                <View style={[styles.routeTypeHeader, { borderLeftColor: '#7E57C2', backgroundColor: selectedExit ? '#f8f8f8' : '#EDE7F6' }]}>
                                  <Text style={[styles.routeTypeEn, { color: '#7E57C2' }]}>{sectionLabelEn}</Text>
                                  <Text style={styles.routeTypeKo}>{sectionLabelKo}</Text>
                                </View>
                              )}
                              {renderRouteCard(path, cardKey, isExpanded, lineColor, selectedExit ? 0.7 : 1)}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* 데이터 출처 */}
          <View style={styles.dataSource}>
            <Text style={styles.dataSourceText}>Route data: KRIC · Elevator status: Seoul Open Data Plaza</Text>
          </View>

        </ScrollView>

        {/* Floating Action Button for Facilities */}
        <TouchableOpacity
          style={styles.fab}
          onPress={navigateToFacilities}
          activeOpacity={0.8}
        >
          <View style={styles.fabIconGroup}>
            <Text style={styles.fabIcon}>🚽</Text>
            <Text style={styles.fabIcon}>🧳</Text>
            <Text style={styles.fabIcon}>💳</Text>
          </View>
          <View style={styles.fabTextContainer}>
            <Text style={styles.fabLabelEn}>Facilities</Text>
            <Text style={styles.fabLabelKo}>편의시설</Text>
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f4f2fb' },
  scrollContent: { paddingBottom: 40 },

  stationHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#e8e4f8', borderBottomWidth: 1, borderBottomColor: '#d4cef0' },
  stationHeaderLeft: { flex: 1 },
  stationHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  stationNameEn: { fontSize: 22, fontFamily: 'Nunito-ExtraBold', color: '#1a1040', marginBottom: 2 },
  stationNameKo: { fontSize: 13, color: '#757575' },
  headerBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 0.5, borderColor: 'transparent' },
  headerBadgeText: { fontSize: 11, fontFamily: 'Nunito-Bold' },
  lineCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lineCircleText: { color: '#fff', fontFamily: 'Nunito-ExtraBold' },

  sectionBlock: { marginHorizontal: 16, marginTop: 20, backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#e8e8e8', overflow: 'hidden' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', backgroundColor: '#fafafa' },
  sectionIconWrap: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#ede9f8', alignItems: 'center', justifyContent: 'center' },
  sectionHeadingIcon: { fontSize: 16, color: '#7c65c1' },
  sectionHeadingTitle: { fontSize: 15, fontFamily: 'Nunito-Bold', color: '#212121' },
  sectionHeadingSubtitle: { fontSize: 11, color: '#9e9e9e', marginTop: 1 },
  statusLoadingText: { fontSize: 11, color: '#FFA000' },

  exitTable: { paddingHorizontal: 16 },
  exitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 13 },
  exitRowDivider: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  exitNumber: { fontSize: 15, fontFamily: 'Nunito-Bold', color: NAVY },
  exitLandmarkEn: { fontSize: 13, color: '#475569', fontFamily: 'Nunito-Medium', fontWeight: '500', marginTop: 1 },
  exitLandmarkKo: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  exitLabelKo: { fontSize: 12, color: '#9e9e9e', marginTop: 2 },

  statusBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4 },
  statusTextEn: { fontSize: 12, fontFamily: 'Nunito-SemiBold', textAlign: 'right' },
  statusTextKo: { fontSize: 10, color: '#9e9e9e', marginTop: 2, textAlign: 'right' },

  loader: { marginVertical: 24 },
  emptyBox: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji: { fontSize: 32, marginBottom: 10 },
  emptyText: { fontSize: 14, fontFamily: 'Nunito-SemiBold', color: '#616161' },
  emptySubtext: { fontSize: 12, color: '#9e9e9e', marginTop: 4 },

  lineGroup: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  lineGroupHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 6, paddingLeft: 4 },
  lineGroupTitle: { fontSize: 13, fontFamily: 'Nunito-ExtraBold' },

  routeTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#EDE7F6',
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  routeTypeEn: { fontSize: 13, fontFamily: 'Nunito-ExtraBold' },
  routeTypeKo: { fontSize: 12, color: '#9575CD', marginLeft: 4 },

  routeCard: { backgroundColor: 'transparent', marginBottom: 4, overflow: 'hidden' },
  routeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  routeName: { fontSize: 13, fontFamily: 'Nunito-Bold', color: '#333' },
  routeNameKo: { fontSize: 11, color: '#9e9e9e', marginTop: 1 },
  chevronWrap: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  chevronInner: { width: 8, height: 8, borderRightWidth: 1.5, borderBottomWidth: 1.5, transform: [{ rotate: '45deg' }], marginTop: -4 },
  chevronUp: { transform: [{ rotate: '-135deg' }], marginTop: 4 },

  routeSteps: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: '#F8F9FA', // Light gray background to distinguish the area
    width: '100%',
  },
  routeStepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stepNum: { fontSize: 15, fontFamily: 'Nunito-Bold', marginRight: 8, flexShrink: 0, lineHeight: 20 },
  stepTextBlock: { flex: 1 },
  routeStepEn: { fontSize: 13, color: '#424242', lineHeight: 20 },
  routeStepKo: { fontSize: 11, color: '#9e9e9e', marginTop: 2 },

  stepPhotoWrapper: { marginBottom: 10, marginTop: 4, borderRadius: 8, overflow: 'hidden' },
  routePhoto: { width: '100%', height: 160 },
  routePhotoCaption: { fontSize: 11, color: '#9e9e9e', paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#fafafa' },

  dataSource: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  dataSourceText: { fontSize: 10, color: '#bdbdbd', textAlign: 'center' },

  // Floating Action Button
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#5d4da1',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  fabIconGroup: {
    flexDirection: 'row',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
  },
  fabIcon: {
    fontSize: 15,
    marginHorizontal: 1,
  },
  fabTextContainer: {
    alignItems: 'flex-start',
  },
  fabLabelEn: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    lineHeight: 15,
  },
  fabLabelKo: {
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    fontSize: 10,
    marginTop: 1,
  },
  transferDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 12,
    marginHorizontal: 8,
  },
  transferDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  transferDividerText: {
    fontSize: 12,
    fontFamily: 'Nunito-Bold',
    color: '#9e9e9e',
    marginHorizontal: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Best Door Highlight
  bestDoorHighlight: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  bestDoorHighlightEmoji: { fontSize: 24, marginRight: 12 },
  bestDoorHighlightTitle: { fontSize: 11, fontFamily: 'Nunito-Bold', color: '#2E7D32', textTransform: 'uppercase' },
  bestDoorHighlightValue: { fontSize: 16, fontFamily: 'Nunito-ExtraBold', color: '#1B5E20' },
});
