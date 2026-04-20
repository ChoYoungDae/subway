import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function RouteHeaderCard({ origin, destination, time, transfers }) {
    return (
        <View style={styles.card}>
            <Text style={styles.routeText}>{origin} <Text style={{ fontFamily: 'Nunito-Bold' }}>to</Text></Text>
            <Text style={styles.routeText}>{destination}</Text>
            <Text style={styles.routeTextKo}>{origin} → {destination}</Text>

            <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="clock-outline" size={20} color="#8E8E93" />
                    <Text style={styles.summaryValue}>{time} <Text style={styles.summaryUnit}>min</Text></Text>
                </View>
                <View style={styles.dotSeparator} />
                <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="human-walking" size={20} color="#8E8E93" />
                    <Text style={styles.summaryValue}>{transfers} <Text style={styles.summaryUnit}>Transfer</Text></Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#1E242F',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
    },
    routeText: {
        color: '#FFFFFF',
        fontSize: 28,
        fontFamily: 'Nunito-ExtraBold',
        lineHeight: 34,
    },
    routeTextKo: {
        color: '#8E8E93',
        fontSize: 16,
        marginTop: 6,
        marginBottom: 24,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    summaryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    summaryValue: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    summaryUnit: {
        color: '#8E8E93',
        fontSize: 16,
        fontWeight: '400',
    },
    dotSeparator: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#444',
        marginHorizontal: 16,
    }
});
