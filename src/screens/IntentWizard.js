import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    SafeAreaView,
    TextInput,
    FlatList,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLineColor, getLineBadgeLabel } from '../utils/lineColors';
import { supabase } from '../../lib/supabase';
import { matchesChosung } from '../utils/chosung';
import { useAppLang, tLang } from '../context/LanguageContext';
import { STRINGS } from '../i18n/strings';

const NAVY = '#3d2f7a';

export default function IntentWizard({ route, navigation }) {
    const { lang } = useAppLang();
    const { stationId, nameEn, nameKo, stationLines = [] } = route.params || {};
    const [step, setStep] = useState(1); // 1: Intent, 2: Destination/Transfer Line
    const [intent, setIntent] = useState(null); // 'IN', 'OUT', 'TRANSFER'
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [destStation, setDestStation] = useState(null);
    const [transferLine, setTransferLine] = useState(null);

    const handleIntentSelect = (intentType) => {
        setIntent(intentType);
        if (intentType === 'OUT') {
            finish({ intent: 'OUT' });
        } else {
            setStep(2);
        }
    };

    const handleSearch = async (text) => {
        setQuery(text);
        if (text.length < 1) {
            setResults([]);
            return;
        }

        const q = text.toLowerCase().trim();
        // Simple mock search or DB search
        try {
            const { data } = await supabase
                .from('stations')
                .select('name_ko, name_en, line')
                .or(`name_ko.ilike.%${q}%,name_en.ilike.%${q}%`)
                .limit(10);

            // Deduplicate by name
            const unique = [];
            const seen = new Set();
            (data || []).forEach(s => {
                if (!seen.has(s.name_ko)) {
                    seen.add(s.name_ko);
                    unique.push(s);
                }
            });
            setResults(unique);
        } catch (e) {
            console.error(e);
        }
    };

    const finish = (params) => {
        navigation.navigate('Exit', {
            stationId,
            nameEn,
            nameKo,
            stationLines,
            wizardResult: {
                intent: intent || params.intent,
                destStation: destStation || params.destStation,
                transferLine: transferLine || params.transferLine
            }
        });
    };

    const renderIntentStep = () => (
        <View style={styles.container}>
            <Text style={styles.title}>How can I help you today?</Text>
            <Text style={styles.subtitle}>{nameEn} ({nameKo})</Text>

            <View style={styles.intentGrid}>
                <TouchableOpacity
                    style={[styles.intentCard, { borderColor: '#7c65c1' }]}
                    onPress={() => handleIntentSelect('IN')}
                >
                    <View style={[styles.iconBox, { backgroundColor: '#f0ecff' }]}>
                        <MaterialCommunityIcons name="login" size={32} color="#7c65c1" />
                    </View>
                    <Text style={styles.intentTitle}>{tLang(STRINGS.intent.entrance, lang)}</Text>
                    <Text style={styles.intentDesc}>{tLang(STRINGS.intent.entranceDesc, lang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.intentCard, { borderColor: '#7c65c1' }]}
                    onPress={() => handleIntentSelect('OUT')}
                >
                    <View style={[styles.iconBox, { backgroundColor: '#f0ecff' }]}>
                        <MaterialCommunityIcons name="logout" size={32} color="#7c65c1" />
                    </View>
                    <Text style={styles.intentTitle}>{tLang(STRINGS.intent.exit, lang)}</Text>
                    <Text style={styles.intentDesc}>{tLang(STRINGS.intent.exitDesc, lang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.intentCard, { borderColor: '#7c65c1' }]}
                    onPress={() => handleIntentSelect('TRANSFER')}
                >
                    <View style={[styles.iconBox, { backgroundColor: '#f0ecff' }]}>
                        <MaterialCommunityIcons name="transit-transfer" size={32} color="#7c65c1" />
                    </View>
                    <Text style={styles.intentTitle}>{tLang(STRINGS.intent.transfer, lang)}</Text>
                    <Text style={styles.intentDesc}>{tLang(STRINGS.intent.transferDesc, lang)}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderSecondaryStep = () => {
        if (intent === 'IN' || intent === 'TRANSFER') {
            return (
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <Text style={styles.title}>Where are you going?</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search destination station"
                        value={query}
                        onChangeText={handleSearch}
                        autoFocus
                    />

                    <FlatList
                        data={results}
                        keyExtractor={(item) => item.name_ko}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.resultItem}
                                onPress={() => finish({ destStation: item })}
                            >
                                <Text style={styles.resultText}>{item.name_ko}</Text>
                                <Text style={styles.resultSubtext}>{item.name_en}</Text>
                            </TouchableOpacity>
                        )}
                        style={styles.resultsList}
                    />

                    <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                        <Text style={styles.backBtnText}>Back</Text>
                    </TouchableOpacity>
                </KeyboardAvoidingView>
            );
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            {step === 1 ? renderIntentStep() : renderSecondaryStep()}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#f4f2fb' },
    container: { flex: 1, padding: 24 },
    title: { fontSize: 22, fontWeight: '800', color: NAVY, marginBottom: 8, textAlign: 'center' },
    subtitle: { fontSize: 16, color: '#666', marginBottom: 32, textAlign: 'center' },
    intentGrid: { gap: 16 },
    intentCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        borderWidth: 2,
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    intentEmoji: { fontSize: 32, marginBottom: 8 },
    iconBox: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12
    },
    intentTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', color: '#1a1040' },
    intentDesc: { fontSize: 13, color: '#757575', textAlign: 'center', marginTop: 4 },

    searchInput: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        borderWidth: 1,
        borderColor: '#ddd',
        marginBottom: 16,
    },
    resultsList: { flex: 1 },
    resultItem: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    resultText: { fontSize: 16, fontFamily: 'Nunito-SemiBold', color: '#333' },
    resultSubtext: { fontSize: 12, color: '#999' },
    backBtn: { padding: 16, alignItems: 'center' },
    backBtnText: { color: NAVY, fontFamily: 'Nunito-Bold' }
});
