import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text } from 'react-native';
import OriginSegmentUI from './OriginSegmentUI';
import TransitSegmentUI from './TransitSegmentUI';
import DestinationSegmentUI from './DestinationSegmentUI';

/**
 * JourneyMasterView: Orchestrates the 3-Segment Barrier-Free Journey.
 * Manages global state for segment expansion and active stage highlighting.
 */
const JourneyMasterView = ({
    originSegments,
    transitSegments,
    destinationSegments,
    userLocation, // { latitude, longitude, distanceToOrigin }
    currentStation, // current station during transit
    targetStation, // destination station
    stopsRemaining // number of stops until destination
}) => {
    // Stage-specific expansion states
    const [expandedStage, setExpandedStage] = useState({
        origin: true,
        transit: false,
        destination: false
    });

    // Track stages that the user has manually toggled to prevent auto-overwrites
    const [manuallyInteracted, setManuallyInteracted] = useState({
        origin: false,
        transit: false,
        destination: false
    });

    // Auto-expansion logic based on real-time context
    useEffect(() => {
        setExpandedStage(prev => {
            const newState = { ...prev };

            // 1. Origin: Auto-expand if near (GPS < 200m) and not manually closed
            if (!manuallyInteracted.origin && userLocation && userLocation.distanceToOrigin < 200) {
                newState.origin = true;
            }

            // 2. Transit: Auto-expand when boarding starts and not manually closed
            if (!manuallyInteracted.transit && currentStation) {
                if (!prev.transit) {
                    newState.transit = true;
                    // Auto-collapse origin only if not manually pinned
                    if (!manuallyInteracted.origin) newState.origin = false;
                }
            }

            // 3. Destination: Auto-expand 2 stops before arrival and not manually closed
            if (!manuallyInteracted.destination && stopsRemaining !== undefined && stopsRemaining <= 2) {
                if (!prev.destination) {
                    newState.destination = true;
                    // Auto-collapse transit only if not manually pinned
                    if (!manuallyInteracted.transit) newState.transit = false;
                }
            }

            return newState;
        });
    }, [userLocation?.distanceToOrigin, currentStation, stopsRemaining, manuallyInteracted]);

    const toggleStage = (stage) => {
        // Mark as manually interacted to stop auto-updates for this stage
        setManuallyInteracted(prev => ({ ...prev, [stage]: true }));

        setExpandedStage(prev => ({
            ...prev,
            [stage]: !prev[stage]
        }));
    };

    return (
        <View style={styles.masterContainer}>
            {/* Stage 1: Origin */}
            <TouchableOpacity onPress={() => toggleStage('origin')} activeOpacity={0.9}>
                <OriginSegmentUI segments={originSegments} isDetailed={expandedStage.origin} />
            </TouchableOpacity>

            {/* Visual Connector between 1 & 2 */}
            <View style={styles.masterConnector} />

            {/* Stage 2: Transit */}
            <TouchableOpacity onPress={() => toggleStage('transit')} activeOpacity={0.9}>
                <TransitSegmentUI segments={transitSegments} isDetailed={expandedStage.transit} />
            </TouchableOpacity>

            {/* Visual Connector between 2 & 3 */}
            <View style={styles.masterConnector} />

            {/* Stage 3: Destination */}
            <TouchableOpacity onPress={() => toggleStage('destination')} activeOpacity={0.9}>
                <DestinationSegmentUI segments={destinationSegments} isDetailed={expandedStage.destination} />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    masterContainer: {
        paddingVertical: 10,
        backgroundColor: 'transparent',
    },
    masterConnector: {
        width: 2,
        height: 20,
        backgroundColor: '#EFEFEF',
        alignSelf: 'center',
        marginTop: -12,
        marginBottom: -12,
        zIndex: -1,
    }
});

export default JourneyMasterView;
