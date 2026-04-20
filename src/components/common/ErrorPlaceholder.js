import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * ErrorPlaceholder: Actionable error UI for missing or failed data.
 * Standard: Bilingual (English first, Korean second)
 */
const ErrorPlaceholder = ({ message, messageKo, onRetry, isCompact = false }) => {
    return (
        <View style={[styles.container, isCompact && styles.compactContainer]}>
            <MaterialCommunityIcons
                name="alert-circle-outline"
                size={isCompact ? 24 : 40}
                color={isCompact ? "#ef4444" : "#f59e0b"}
            />
            <View style={[styles.textContainer, isCompact && styles.compactTextContainer]}>
                <Text style={[styles.messageEn, isCompact && styles.compactMessageEn]}>
                    {message || 'Something went wrong'}
                </Text>
                <Text style={[styles.messageKo, isCompact && styles.compactMessageKo]}>
                    {messageKo || '문제가 발생했습니다'}
                </Text>
            </View>

            {onRetry && (
                <TouchableOpacity
                    style={[styles.retryBtn, isCompact && styles.compactRetryBtn]}
                    onPress={onRetry}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="refresh" size={14} color="#fff" />
                    <Text style={[styles.retryText, isCompact && styles.compactRetryText]}>Retry [다시 시도]</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fffbeb',
        borderRadius: 16,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fef3c7',
        marginVertical: 10,
    },
    textContainer: {
        alignItems: 'center',
        marginVertical: 12,
    },
    messageEn: {
        fontSize: 14,
        fontFamily: 'Nunito-Bold',
        color: '#b45309',
        textAlign: 'center',
    },
    messageKo: {
        fontSize: 12,
        fontFamily: 'Pretendard-Regular',
        color: '#d97706',
        marginTop: 2,
        textAlign: 'center',
    },
    retryBtn: {
        backgroundColor: '#7c65c1',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    retryText: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'Nunito-ExtraBold',
    },
    compactContainer: {
        padding: 12,
        backgroundColor: '#fef2f2',
        borderColor: '#fee2e2',
        marginVertical: 4,
        alignItems: 'flex-start',
    },
    compactTextContainer: {
        alignItems: 'flex-start',
        marginVertical: 4,
    },
    compactMessageEn: {
        fontSize: 12,
        color: '#991b1b',
        textAlign: 'left',
    },
    compactMessageKo: {
        fontSize: 10,
        color: '#991b1b',
        textAlign: 'left',
    },
    compactRetryBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 4,
    },
    compactRetryText: {
        fontSize: 11,
    }
});

export default ErrorPlaceholder;
