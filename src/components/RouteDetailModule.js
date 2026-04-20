import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getLineColor } from '../utils/lineColors'; // Ensure line colors are imported if we want to use them

const RouteDetailModule = ({ journeyNodes = [] }) => {
    if (!journeyNodes || journeyNodes.length === 0) {
        return <Text>No detailed path available.</Text>;
    }

    const renderNode = (node, idx, isLast) => {
        // 1. Handle Station Headers
        if (node.isStationHeader) {
            const isOrigin = node.type === 'ORIGIN';
            const isDest = node.type === 'DESTINATION';

            let headerIcon = 'train-car';
            let headerColor = '#6B7280';

            if (isOrigin) { headerIcon = 'map-marker-radius'; headerColor = '#3B82F6'; }
            else if (isDest) { headerIcon = 'flag-checkered'; headerColor = '#EF4444'; }
            else { headerIcon = 'swap-horizontal-circle-outline'; headerColor = '#8B5CF6'; } // Transfer

            const lineColColor = getLineColor(node.lineName) || '#9CA3AF';

            return (
                <View key={`header-${idx}`} style={styles.headerRow}>
                    <View style={styles.timelineCol}>
                        <View style={[styles.headerIconCircle, { backgroundColor: headerColor }]}>
                            <MaterialCommunityIcons name={headerIcon} size={18} color="#fff" />
                        </View>
                        {!isLast && <View style={styles.connector} />}
                    </View>
                    <View style={styles.headerContentCol}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.lineBadge, { backgroundColor: lineColColor }]}>
                                <Text style={styles.lineBadgeText}>{node.lineName}</Text>
                            </View>
                            <Text style={styles.headerStationEn}>{node.stationNameEn || node.stationNameKo}</Text>
                        </View>
                        {node.stationNameKo && node.stationNameEn && (
                            <Text style={styles.headerStationKo}>{node.stationNameKo}</Text>
                        )}
                    </View>
                </View>
            );
        }

        // 2. Handle Normal Nodes (Atoms)
        const { floor, facility, action, exit, category, refined_kr, refined_en } = node;

        const ICON_MAP = {
            ELEVATOR: 'elevator-passenger-outline',
            LIFT: 'wheelchair-accessibility',
            GATE: 'ray-start-arrow',
            EXIT: 'logout',
            PLATFORM: 'train-variant',
            CONCOURSE: 'human-walking',
            General: 'human-walking',
        };

        const iconName = ICON_MAP[facility] || 'checkbox-blank-circle-outline';

        let facilityTextEn = facility;
        if (category && category !== "Unknown") {
            facilityTextEn = refined_en || refined_kr;
        } else {
            // Legacy fallbacks
            if (facility === 'EXIT' && exit) {
                facilityTextEn = `Exit ${exit}`;
            } else if (facility === 'PLATFORM') {
                facilityTextEn = 'Platform';
            } else if (facility === 'ELEVATOR') {
                facilityTextEn = 'Elevator';
            } else if (facility === 'LIFT') {
                facilityTextEn = 'Lift';
            } else if (facility === 'GATE') {
                facilityTextEn = 'Gate';
            } else if (facility === 'CONCOURSE') {
                facilityTextEn = 'Concourse';
            } else if (facility === 'General') {
                facilityTextEn = 'Boarding';
            }
        }

        return (
            <View key={`node-${idx}`} style={styles.segmentRow}>
                <View style={styles.timelineCol}>
                    <View style={styles.iconCircle}>
                        <MaterialCommunityIcons name={iconName} size={18} color="#4B5563" />
                    </View>
                    {floor && (
                        <View style={styles.floorBadge}>
                            <Text style={styles.floorBadgeText}>{floor}</Text>
                        </View>
                    )}
                    {!isLast && <View style={styles.connector} />}
                </View>

                <View style={styles.contentCol}>
                    <Text style={styles.facilityMain}>{facilityTextEn}</Text>
                    {category && category !== "Unknown" && refined_kr && (
                        <Text style={styles.facilitySub}>{refined_kr}</Text>
                    )}
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            {journeyNodes.map((node, idx) => renderNode(node, idx, idx === journeyNodes.length - 1))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', paddingHorizontal: 16, paddingBottom: 20 },

    // Header Styles
    headerRow: { flexDirection: 'row', minHeight: 60, alignItems: 'flex-start', marginTop: 10 },
    headerIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', zIndex: 1, marginTop: 4 },
    headerContentCol: { flex: 1, justifyContent: 'center', paddingTop: 6, paddingBottom: 16 },
    headerStationEn: { fontSize: 18, fontWeight: '800', color: '#111827', marginLeft: 8 },
    headerStationKo: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 2, marginLeft: 2 },
    lineBadge: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, justifyContent: 'center' },
    lineBadgeText: { fontSize: 11, fontWeight: '800', color: '#fff' },

    // Normal Node Styles
    segmentRow: { flexDirection: 'row', minHeight: 50, alignItems: 'flex-start' },
    timelineCol: { alignItems: 'center', marginRight: 12, width: 30 },
    iconCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', zIndex: 1, marginTop: 6 },
    connector: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: 2 },
    contentCol: { flex: 1, justifyContent: 'center', paddingTop: 8, paddingBottom: 16 },
    facilityMain: { fontSize: 15, fontWeight: '700', color: '#374151' },
    facilitySub: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 2 },
    floorBadge: { backgroundColor: '#E2E8F0', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, marginTop: 4, zIndex: 2 },
    floorBadgeText: { fontSize: 10, fontWeight: '800', color: '#475569' },
});

export default RouteDetailModule;
