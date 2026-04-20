import React, { useState, useEffect } from 'react';
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
import { useLanguage, saveLanguage, LANGUAGE_KEY } from '../hooks/useLanguage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Color Palette (CLAUDE.md) ─────────────────────────────────────────────────
const ACCENT      = '#C8362A';   // Dancheong Red
const BG          = '#F7F7FA';   // Light BG
const CARD        = '#FFFFFF';   // Card White
const BORDER      = '#E8E8EE';
const TEXT_MAIN   = '#111116';   // Gwakgi Dark Gray
const TEXT_SUB    = '#AAABB8';   // Muted Text
const TEXT_BODY   = '#3D3D4A';   // Stone Wall Gray
const GREEN       = '#2E5E4A';   // Namsan Pine Green (active badge)

// ── Language Data ─────────────────────────────────────────────────────────────
// status: 'active' | 'inactive' | 'disabled'
//   active   → currently selected
//   inactive → available but not selected
//   disabled → not yet supported (shown dimmed)
const LANGUAGES = [
  {
    code: 'en',
    label: 'English',
    sublabel: 'Korean',   // "Korean" in English
    isDefault: true,
    status: 'active',
  },
  {
    code: 'ko',
    label: '한국어',
    sublabel: null,       // No sublabel — avoids "한국어 / 한국어" redundancy
    isDefault: false,
    status: 'disabled',
  },
  {
    code: 'zh-Hans',
    label: '简体中文',
    sublabel: '韩语',     // "Korean" in Simplified Chinese
    isDefault: false,
    status: 'disabled',
  },
  {
    code: 'ja',
    label: '日本語',
    sublabel: '韓国語',   // "Korean" in Japanese
    isDefault: false,
    status: 'disabled',
  },
];

// ── LanguageItem Component ────────────────────────────────────────────────────
function LanguageItem({ lang, isSelected, onPress }) {
  const isDisabled = lang.status === 'disabled';

  return (
    <TouchableOpacity
      style={[styles.item, isSelected && styles.itemSelected]}
      onPress={() => !isDisabled && onPress(lang.code)}
      activeOpacity={isDisabled ? 1 : 0.7}
      disabled={isDisabled}
    >
      <View style={[styles.itemInner, isDisabled && styles.itemDisabled]}>
        {/* Left: language label */}
        <View style={styles.labelGroup}>
          <Text style={[styles.labelMain, isSelected && styles.labelMainActive]}>
            {lang.label}
            {lang.sublabel ? (
              <Text style={styles.labelSub}>  /  {lang.sublabel}</Text>
            ) : null}
          </Text>

          <View style={styles.badgeRow}>
            {isSelected && (
              <View style={styles.badgeActive}>
                <Text style={styles.badgeText}>In use</Text>
              </View>
            )}
            {lang.isDefault && (
              <View style={styles.badgeDefault}>
                <Text style={styles.badgeDefaultText}>Default</Text>
              </View>
            )}
            {isDisabled && (
              <View style={styles.badgeDisabled}>
                <Text style={styles.badgeDisabledText}>Coming soon</Text>
              </View>
            )}
          </View>
        </View>

        {/* Right: radio / coming-soon icon */}
        {isDisabled ? (
          <MaterialCommunityIcons name="lock-outline" size={18} color={TEXT_SUB} />
        ) : isSelected ? (
          <MaterialCommunityIcons name="check-circle" size={22} color={ACCENT} />
        ) : (
          <MaterialCommunityIcons name="circle-outline" size={22} color={TEXT_SUB} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const REPORT_FORM_URL = 'https://forms.gle/PLACEHOLDER'; // Replace with actual Google Form URL

// ── SettingsScreen ────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const currentLang = useLanguage();
  const [selectedLang, setSelectedLang] = useState(currentLang);

  useEffect(() => { setSelectedLang(currentLang); }, [currentLang]);

  const handleSelectLang = (code) => {
    setSelectedLang(code);
    saveLanguage(code);
  };

  const handleOpenReportForm = () => {
    Linking.openURL(REPORT_FORM_URL);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title */}
        <Text style={styles.pageTitle}>Settings</Text>

        {/* Language section */}
        <Text style={styles.sectionTitle}>Language</Text>
        <Text style={styles.sectionDesc}>
          Choose the display language for this app.
        </Text>

        <View style={styles.card}>
          {LANGUAGES.map((lang, idx) => (
            <React.Fragment key={lang.code}>
              <LanguageItem
                lang={lang}
                isSelected={selectedLang === lang.code}
                onPress={handleSelectLang}
              />
              {idx < LANGUAGES.length - 1 && <View style={styles.divider} />}
            </React.Fragment>
          ))}
        </View>

        <Text style={styles.sectionNote}>
          More languages will be added in future updates.
        </Text>

        {/* Report & Suggestion section */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Report & Suggestion</Text>
        <Text style={styles.sectionDesc}>
          We accept reports on the following topics:
          {'\n'}· Wrong Path (잘못된 경로)
          {'\n'}· Information Error (정보 오류)
          {'\n'}· Feature Suggestion (기능 제안)
          {'\n'}· Other Inquiries (기타 문의 및 의견)
        </Text>

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.item}
            onPress={handleOpenReportForm}
            activeOpacity={0.7}
          >
            <View style={styles.itemInner}>
              <View style={styles.labelGroup}>
                <Text style={styles.reportLabel}>Submit via Google Form</Text>
                <Text style={styles.reportSub}>Opens in browser</Text>
              </View>
              <MaterialCommunityIcons name="open-in-new" size={20} color={ACCENT} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Page header
  pageTitle: {
    fontSize: 24,
    fontFamily: 'Nunito-Bold',
    color: TEXT_MAIN,
    marginTop: 24,
    marginBottom: 28,
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Nunito-SemiBold',
    color: TEXT_BODY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  sectionDesc: {
    fontSize: 13,
    color: TEXT_SUB,
    marginBottom: 12,
  },
  sectionNote: {
    fontSize: 12,
    color: TEXT_SUB,
    marginTop: 10,
    textAlign: 'center',
  },

  // Card
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  // Item
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  itemSelected: {
    backgroundColor: '#FDF5F5',  // very light red tint
  },
  itemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemDisabled: {
    opacity: 0.45,
  },

  // Label
  labelGroup: {
    flex: 1,
    marginRight: 12,
  },
  labelMain: {
    fontSize: 16,
    fontFamily: 'Nunito-Medium',
    color: TEXT_MAIN,
  },
  labelMainActive: {
    color: ACCENT,
    fontFamily: 'Nunito-SemiBold',
  },
  labelSub: {
    fontSize: 14,
    fontFamily: 'Nunito-Regular',
    color: TEXT_SUB,
  },

  // Badge row
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 5,
  },
  badgeActive: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Nunito-SemiBold',
  },
  badgeDefault: {
    backgroundColor: GREEN,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeDefaultText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Nunito-Medium',
  },
  badgeDisabled: {
    backgroundColor: '#EEEEF3',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeDisabledText: {
    fontSize: 10,
    color: TEXT_SUB,
    fontFamily: 'Nunito-Medium',
  },

  // Report row
  reportLabel: {
    fontSize: 16,
    fontFamily: 'Nunito-SemiBold',
    color: ACCENT,
  },
  reportSub: {
    fontSize: 12,
    fontFamily: 'Nunito-Regular',
    color: TEXT_SUB,
    marginTop: 2,
  },

  // Divider
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 16,
  },
});
