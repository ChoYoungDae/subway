import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, StatusBar, Image } from 'react-native';
import { useAppLang, tLang } from '../../context/LanguageContext';
import { STRINGS } from '../../i18n/strings';

const { width, height } = Dimensions.get('window');

const BG_COLOR = '#111116';
const RED = '#C8362A';
const SILVER = '#8A9CA3';

const SplashScreen = () => {
    const { lang } = useAppLang();
    // Animation Values
    const logoScale = useRef(new Animated.Value(0)).current;
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const dot1 = useRef(new Animated.Value(0.3)).current;
    const dot2 = useRef(new Animated.Value(0.3)).current;
    const dot3 = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        // Logo and Title Sequential Animation
        Animated.sequence([
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 7,
                useNativeDriver: true,
            }),
            Animated.timing(titleOpacity, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
        ]).start();

        // Dots Sequential Pulse Animation
        const pulse = (anim) => {
            return Animated.sequence([
                Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
            ]);
        };

        const startDotsAnimation = () => {
            Animated.loop(
                Animated.stagger(200, [
                    pulse(dot1),
                    pulse(dot2),
                    pulse(dot3),
                ])
            ).start();
        };

        startDotsAnimation();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={BG_COLOR} />

            {/* Concentric Circles Background */}
            <View style={[styles.circle, { width: width * 1.2, height: width * 1.2, opacity: 0.08, borderColor: RED }]} />
            <View style={[styles.circle, { width: width * 0.9, height: width * 0.9, opacity: 0.12, borderColor: RED }]} />
            <View style={[styles.circle, { width: width * 0.6, height: width * 0.6, opacity: 0.18, borderColor: RED }]} />

            {/* Logo Section */}
            <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }] }]}>
                <Image
                    source={require('../../../assets/icon.png')}
                    style={styles.logoImage}
                    resizeMode="cover"
                />
            </Animated.View>

            {/* Text Section */}
            <Animated.View style={[styles.textContainer, { opacity: titleOpacity }]}>
                <Text style={styles.title}>
                    <Text style={styles.redS}>S</Text>tep-Free <Text style={styles.redS}>S</Text>eoul <Text style={styles.redS}>S</Text>ubway
                </Text>
                <Text style={styles.subtitle}>{tLang(STRINGS.splash.subtitle, lang)}</Text>
                <Text style={styles.tagline}>No more dragging suitcases!</Text>
            </Animated.View>

            {/* Loading Indicator */}
            <View style={styles.dotsContainer}>
                <Animated.View style={[styles.dot, { opacity: dot1 }]} />
                <Animated.View style={[styles.dot, { opacity: dot2 }]} />
                <Animated.View style={[styles.dot, { opacity: dot3 }]} />
            </View>

            {/* Version */}
            <Text style={styles.version}>v1.0.0</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_COLOR,
        justifyContent: 'center',
        alignItems: 'center',
    },
    circle: {
        position: 'absolute',
        borderRadius: 999,
        borderWidth: 1,
    },
    logoContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 120, // 로고를 아래로 내리기 위해 설정 (기존 0)
    },
    logoImage: {
        width: 120,
        height: 120,
        borderRadius: 26,
        elevation: 10,
        shadowColor: RED,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    textContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontFamily: 'Nunito-ExtraBold',
        color: '#FFFFFF',
        marginBottom: 12,
        letterSpacing: -0.5,
    },
    redS: {
        color: RED,
        fontFamily: 'Nunito-ExtraBold',
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Pretendard-Regular',
        color: SILVER,
        marginBottom: 8,
    },
    tagline: {
        fontSize: 14,
        color: SILVER,
        fontStyle: 'italic',
        opacity: 0.7,
    },
    dotsContainer: {
        flexDirection: 'row',
        position: 'absolute',
        bottom: 120,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: RED,
        marginHorizontal: 6,
    },
    version: {
        position: 'absolute',
        bottom: 40,
        color: '#3D3D4A',
        fontSize: 12,
        fontFamily: 'monospace',
    },
});

export default SplashScreen;
