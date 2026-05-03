import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PRIMARY  = '#C8362A';  // Dancheong Red
const INACTIVE = '#AAABB8';  // Muted Text

const TABS = [
  { id: 'Route',    icon: 'directions-fork', label: 'Route'    },
  { id: 'Station',  icon: 'train-variant',   label: 'Station'  },
  { id: 'Help',     icon: 'phone',           label: 'Help'     },
  { id: 'Settings', icon: 'cog',             label: 'Settings' },
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

  return (
    // 외부 컨테이너: 화면 하단에 밀착
    <View
      style={{
        backgroundColor: '#FFFFFF',
        paddingBottom: insets.bottom,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderTopWidth: 0.5,
        borderTopColor: '#E8E8EE',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 8,
        overflow: 'hidden', // 라운드 효과를 위해 추가
      }}
    >
      {/* 내부 네비바: 각진 형태 */}
      <View
        style={{
          flexDirection: 'row',
          paddingVertical: 10,
          paddingHorizontal: 4,
        }}
      >
        {TABS.map(({ id, icon, label }) => {
          const active = activeRouteName === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => handlePress(id)}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
              activeOpacity={0.75}
            >
              {/* 아이콘 pill: 선택된 것만 둥글게 */}
              <View
                style={{
                  width: 64,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? PRIMARY : 'transparent',
                  marginBottom: 4,
                }}
              >
                <MaterialCommunityIcons
                  name={icon}
                  size={24}
                  color={active ? '#FFFFFF' : INACTIVE}
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
    </View>
  );
}
