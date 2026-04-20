/**
 * HelpScreen — Help 탭
 * Categories: 24/7 Support · Lost & Found · Tickets & Fare · Luggage Services
 */
import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, Linking,
    StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import helpData from '../data/helpContent.json';

// ── Palette (CLAUDE.md) ────────────────────────────────────────────────────────
const C = {
    primary:  '#C8362A',
    bg:       '#F7F7FA',
    card:     '#FFFFFF',
    border:   '#E8E8EE',
    muted:    '#AAABB8',
    silver:   '#8A9CA3',
    text:     '#111116',
    subtext:  '#555568',
    activeBg: '#FCECEA',
    headerBg: '#FAFAFA',
    wifi:     '#0077CC',
};

// ── Types ──────────────────────────────────────────────────────────────────────
type ItemType = 'phone' | 'wifi_call' | 'chat_web' | 'link' | 'info' | 'accordion_text';

interface HelpItem {
    id: string;
    type: ItemType;
    label_en: string;
    label_ko?: string;
    desc_en?: string;
    value?: string;
    url?: string;
    v1: boolean;
}

interface Category {
    id: string;
    icon: string;
    title: string;
    subtitle: string;
    v1: boolean;
    items: HelpItem[];
}

// ── Action button — fixed width so all buttons are the same size ───────────────
function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
    return (
        <TouchableOpacity style={styles.actionBtn} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.actionBtnText}>{label}</Text>
        </TouchableOpacity>
    );
}

// ── Label block (en + optional ko) ────────────────────────────────────────────
function ItemLabels({ item }: { item: HelpItem }) {
    return (
        <>
            <Text style={styles.itemLabel}>{item.label_en}</Text>
            {item.label_ko && <Text style={styles.itemKo}>{item.label_ko}</Text>}
            {item.desc_en && <Text style={styles.itemDesc}>{item.desc_en}</Text>}
        </>
    );
}

// ── Row wrapper ────────────────────────────────────────────────────────────────
function ItemRow({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
    return (
        <View style={styles.itemRow}>
            <View style={styles.itemLeft}>{left}</View>
            {right && <View style={styles.itemRight}>{right}</View>}
        </View>
    );
}

// ── Item renderers ─────────────────────────────────────────────────────────────
function PhoneItem({ item }: { item: HelpItem }) {
    return (
        <ItemRow
            left={<ItemLabels item={item} />}
            right={
                <ActionButton
                    label="Call"
                    onPress={() => Linking.openURL(`tel:${item.value}`)}
                />
            }
        />
    );
}

function WifiCallItem({ item }: { item: HelpItem }) {
    return (
        <ItemRow
            left={<ItemLabels item={item} />}
            right={
                <TouchableOpacity
                    style={styles.wifiBtn}
                    onPress={() => item.url && Linking.openURL(item.url)}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="wifi" size={12} color="#FFFFFF" />
                    <Text style={styles.actionBtnText}>Call</Text>
                </TouchableOpacity>
            }
        />
    );
}

function ChatWebItem({ item }: { item: HelpItem }) {
    return (
        <ItemRow
            left={<ItemLabels item={item} />}
            right={
                <ActionButton
                    label="Chat"
                    onPress={() => item.url && Linking.openURL(item.url)}
                />
            }
        />
    );
}

function LinkItem({ item }: { item: HelpItem }) {
    return (
        <ItemRow
            left={<ItemLabels item={item} />}
            right={
                <ActionButton
                    label="Open"
                    onPress={() => item.url && Linking.openURL(item.url)}
                />
            }
        />
    );
}

function InfoItem({ item }: { item: HelpItem }) {
    return (
        <View style={styles.infoRow}>
            <MaterialCommunityIcons
                name="information-outline"
                size={18}
                color={C.silver}
                style={{ marginTop: 2, flexShrink: 0 }}
            />
            <View style={styles.infoText}>
                <ItemLabels item={item} />
            </View>
        </View>
    );
}

function AccordionItem({ item }: { item: HelpItem }) {
    const [open, setOpen] = useState(false);
    return (
        <View>
            <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setOpen(v => !v)}
                activeOpacity={0.7}
            >
                <View style={styles.flex1}>
                    <Text style={styles.itemLabel}>{item.label_en}</Text>
                    {item.label_ko && <Text style={styles.itemKo}>{item.label_ko}</Text>}
                </View>
                <MaterialCommunityIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={C.muted}
                />
            </TouchableOpacity>
            {open && (
                <Text style={[styles.itemDesc, styles.accordionBody]}>{item.desc_en}</Text>
            )}
        </View>
    );
}

function RenderItem({ item }: { item: HelpItem }) {
    if (!item.v1) return null;
    switch (item.type) {
        case 'phone':          return <PhoneItem item={item} />;
        case 'wifi_call':      return <WifiCallItem item={item} />;
        case 'chat_web':       return <ChatWebItem item={item} />;
        case 'link':           return <LinkItem item={item} />;
        case 'info':           return <InfoItem item={item} />;
        case 'accordion_text': return <AccordionItem item={item} />;
        default:               return null;
    }
}

// ── Category card (accordion) ─────────────────────────────────────────────────
function CategoryCard({ category }: { category: Category }) {
    const [open, setOpen] = useState(true);
    if (!category.v1) return null;

    const v1Items = category.items.filter(i => i.v1);
    if (v1Items.length === 0) return null;

    return (
        <View style={styles.card}>
            {/* Category header — always visible, tap to collapse */}
            <TouchableOpacity
                style={styles.catHeader}
                onPress={() => setOpen(v => !v)}
                activeOpacity={0.75}
            >
                <View style={styles.catIconWrap}>
                    <MaterialCommunityIcons
                        name={category.icon as any}
                        size={18}
                        color={C.primary}
                    />
                </View>
                <View style={styles.flex1}>
                    <Text style={styles.catTitle}>{category.title}</Text>
                    <Text style={styles.catSubtitle}>{category.subtitle}</Text>
                </View>
                <MaterialCommunityIcons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={C.muted}
                />
            </TouchableOpacity>

            {/* Items */}
            {open && (
                <View style={styles.itemList}>
                    {v1Items.map((item, idx) => (
                        <React.Fragment key={item.id}>
                            {idx > 0 && <View style={styles.divider} />}
                            <RenderItem item={item} />
                        </React.Fragment>
                    ))}
                </View>
            )}
        </View>
    );
}

// ── Screen ────────────────────────────────────────────────────────────────────
export default function HelpScreen() {
    const insets = useSafeAreaInsets();
    const categories: Category[] = (helpData as any).categories;

    return (
        <View style={[styles.root, { paddingTop: insets.top }]}>
            <View style={styles.topBar}>
                <Text style={styles.topBarTitle}>Help</Text>
                <Text style={styles.topBarSub}>도움말 · 긴급 연락처</Text>
            </View>

            <ScrollView
                contentContainerStyle={[
                    styles.scroll,
                    { paddingBottom: insets.bottom + 24 },
                ]}
                showsVerticalScrollIndicator={false}
            >
                {categories.map(cat => (
                    <CategoryCard key={cat.id} category={cat} />
                ))}
            </ScrollView>
        </View>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bg,
    },
    topBar: {
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 12,
    },
    topBarTitle: {
        fontSize: 20,
        fontFamily: 'Nunito-Bold',
        color: C.text,
        letterSpacing: -0.3,
    },
    topBarSub: {
        fontSize: 12,
        color: C.muted,
        marginTop: 1,
    },
    scroll: {
        padding: 16,
    },
    flex1: {
        flex: 1,
    },

    // Card
    card: {
        backgroundColor: C.card,
        borderRadius: 12,
        borderWidth: 0.5,
        borderColor: C.border,
        overflow: 'hidden',
        marginBottom: 12,
    },

    // Category header
    catHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#F0F0F5',
    },
    catIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: C.activeBg,
        alignItems: 'center',
        justifyContent: 'center',
    },
    catTitle: {
        fontSize: 15,
        fontFamily: 'Nunito-Bold',
        color: C.text,
    },
    catSubtitle: {
        fontSize: 11,
        color: C.muted,
        marginTop: 1,
    },

    // Item list
    itemList: {
        paddingHorizontal: 16,
        paddingVertical: 4,
        borderTopWidth: 0.5,
        borderTopColor: C.border,
    },
    divider: {
        height: 0.5,
        backgroundColor: C.border,
    },

    // Item row (phone / chat_web / link)
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
    },
    itemLeft: {
        flex: 1,
    },
    itemRight: {
        flexShrink: 0,
    },
    itemLabel: {
        fontSize: 14,
        fontFamily: 'Nunito-SemiBold',
        color: C.text,
    },
    itemKo: {
        fontSize: 11,
        color: C.muted,
        marginTop: 1,
    },
    itemDesc: {
        fontSize: 12,
        color: C.subtext,
        marginTop: 2,
        lineHeight: 18,
    },

    // Action button — fixed width keeps Call / Chat / Open the same size
    actionBtn: {
        backgroundColor: C.primary,
        borderRadius: 6,
        width: 48,
        paddingVertical: 4,
        alignItems: 'center',
    },
    wifiBtn: {
        backgroundColor: C.wifi,
        borderRadius: 6,
        width: 48,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontFamily: 'Nunito-Bold',
    },

    // Info item
    infoRow: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 12,
    },
    infoText: {
        flex: 1,
    },

    // Accordion item
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
    },
    accordionBody: {
        paddingBottom: 12,
        paddingRight: 4,
        marginTop: 0,
    },
});
