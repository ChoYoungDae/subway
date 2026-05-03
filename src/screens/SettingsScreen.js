import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppLang } from '../context/LanguageContext';

const ACCENT    = '#C8362A';
const BG        = '#F7F7FA';
const CARD      = '#FFFFFF';
const BORDER    = '#E8E8EE';
const TEXT_MAIN = '#111116';
const TEXT_SUB  = '#AAABB8';
const TEXT_BODY = '#555568';
const GREEN     = '#2E5E4A';

const APP_VERSION = '1.0.0';
const FEEDBACK_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdYtc7o7HQ25VpPbjlL1hHZHI4PKQ4YzgT95WZO7VRsVltFkQ/viewform';

const LANGUAGES = [
  { code: 'en',      label: 'English',   sublabel: '영어',  status: 'active',   isDefault: true  },
  // { code: 'ko',      label: '한국어',     sublabel: null,    status: 'disabled', isDefault: false },
  // { code: 'zh-Hans', label: '简体中文',   sublabel: '韩语',  status: 'disabled', isDefault: false },
  // { code: 'ja',      label: '日本語',     sublabel: '韓国語', status: 'disabled', isDefault: false },
];

function LanguageItem({ lang, isSelected, onPress }) {
  const disabled = lang.status === 'disabled';
  return (
    <TouchableOpacity
      style={[styles.row, isSelected && styles.rowSelected]}
      onPress={() => !disabled && onPress(lang.code)}
      activeOpacity={disabled ? 1 : 0.7}
      disabled={disabled}
    >
      <View style={[styles.rowInner, disabled && { opacity: 0.4 }]}>
        <View style={styles.rowLeft}>
          <Text style={[styles.rowLabel, isSelected && { color: ACCENT, fontFamily: 'Nunito-SemiBold' }]}>
            {lang.label}
            {lang.sublabel ? <Text style={styles.rowSub}>  /  {lang.sublabel}</Text> : null}
          </Text>
          <View style={styles.badgeRow}>
            {isSelected && (
              <View style={[styles.badge, { backgroundColor: ACCENT }]}>
                <Text style={styles.badgeText}>사용 중</Text>
              </View>
            )}
            {lang.isDefault && (
              <View style={[styles.badge, { backgroundColor: GREEN }]}>
                <Text style={styles.badgeText}>기본</Text>
              </View>
            )}
            {disabled && (
              <View style={[styles.badge, { backgroundColor: '#EEEEF3' }]}>
                <Text style={[styles.badgeText, { color: TEXT_SUB }]}>준비 중</Text>
              </View>
            )}
          </View>
        </View>
        {disabled
          ? <MaterialCommunityIcons name="lock-outline" size={18} color={TEXT_SUB} />
          : isSelected
            ? <MaterialCommunityIcons name="check-circle" size={22} color={ACCENT} />
            : <MaterialCommunityIcons name="circle-outline" size={22} color={TEXT_SUB} />
        }
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const { lang: selectedLang, setLang } = useAppLang();

  const handleFeedback = () => {
    Linking.openURL(FEEDBACK_URL);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Settings / 설정</Text>

        {/* ── LANGUAGE ─────────────────────────────────── */}
        <Text style={styles.sectionHeader}>Language / 언어</Text>
        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => (
            <React.Fragment key={lang.code}>
              <LanguageItem
                lang={lang}
                isSelected={selectedLang === lang.code}
                onPress={setLang}
              />
              {idx < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>
        <Text style={styles.sectionNote}>추후 더 많은 언어가 추가될 예정입니다. (More languages coming soon)</Text>

        {/* ── ABOUT ────────────────────────────────────── */}
        <Text style={[styles.sectionHeader, { marginTop: 32 }]}>About / 정보</Text>
        <View style={styles.card}>
          {/* Version row */}
          <View style={styles.row}>
            <View style={styles.rowInner}>
              <Text style={styles.rowLabel}>Version / 버전</Text>
              <Text style={styles.rowValue}>{APP_VERSION}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Send Feedback row */}
          <TouchableOpacity style={styles.row} onPress={handleFeedback} activeOpacity={0.7}>
            <View style={styles.rowInner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="message-outline" size={20} color={TEXT_BODY} />
                <Text style={styles.rowLabel}>Send Feedback / 의견 보내기</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={TEXT_SUB} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  pageTitle: {
    fontSize: 24,
    fontFamily: 'Nunito-Bold',
    color: TEXT_MAIN,
    marginTop: 24,
    marginBottom: 28,
  },

  sectionHeader: {
    fontSize: 12,
    fontFamily: 'Nunito-SemiBold',
    color: TEXT_SUB,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionNote: {
    fontSize: 12,
    color: TEXT_SUB,
    marginTop: 8,
    textAlign: 'center',
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowSelected: {
    backgroundColor: '#FDF5F5',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: { flex: 1, marginRight: 12 },

  rowLabel: {
    fontSize: 16,
    fontFamily: 'Nunito-Medium',
    color: TEXT_MAIN,
  },
  rowSub: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: TEXT_SUB,
  },
  rowValue: {
    fontSize: 15,
    fontFamily: 'Nunito-Medium',
    color: TEXT_SUB,
  },

  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: 'Nunito-SemiBold',
    color: '#fff',
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 16,
  },
});
