import React from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY = '#C8362A';   // Dancheong Red
const INACTIVE = '#AAABB8';  // Muted Text
const ACTIVE_BG = '#FCECEA'; // Dancheong Red 틴트

const TABS = [
    { id: 'Route', icon: 'directions-fork', label: 'Route' },
    { id: 'Station', icon: 'train-variant', label: 'Station' },
    { id: 'Help', icon: 'phone', label: 'Help' },
    { id: 'Settings', icon: 'cog', label: 'Settings' },
];

export default function BottomNav({ state, navigation, activeTab: propsActiveTab, onTabPress: propsOnTabPress }) {
    const insets = useSafeAreaInsets();
    const activeRouteName = state ? state.routeNames[state.index] : (propsActiveTab || 'Route');

    const handlePress = (routeName) => {
        if (navigation) {
            navigation.navigate(routeName);
        } else {
            propsOnTabPress?.(routeName);
        }
    };

    // Safe Area padding: OS nav bar + 16px 상향 여백
    const bottomPadding = Math.max(insets.bottom, 8) + 16;

    return (
        <View
            style={{
                backgroundColor: '#FFFFFF',
                borderTopWidth: 1,
                borderTopColor: '#E8E8EE',
                flexDirection: 'row',
                paddingTop: 8,
                paddingBottom: bottomPadding,
                // 16px 상향 효과: 아이템들을 위로 당기는 추가 상단 패딩
                paddingHorizontal: 8,
                elevation: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
            }}
        >
            {TABS.map(({ id, icon, label }) => {
                const active = activeRouteName === id;
                return (
                    <TouchableOpacity
                        key={id}
                        onPress={() => handlePress(id)}
                        style={{
                            flex: 1,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                        activeOpacity={0.7}
                    >
                        {/* Pill indicator */}
                        <View
                            style={{
                                width: 64,
                                height: 32,
                                borderRadius: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor: active ? ACTIVE_BG : 'transparent',
                                marginBottom: 4,
                            }}
                        >
                            <MaterialCommunityIcons
                                name={icon}
                                size={24}
                                color={active ? PRIMARY : INACTIVE}
                            />
                        </View>
                        <Text
                            style={{
                                fontSize: 11,
                                fontFamily: active ? 'Nunito-Bold' : 'Nunito-Medium',
                                color: active ? PRIMARY : INACTIVE,
                            }}
                        >
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
