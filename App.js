import React from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFonts } from 'expo-font';
import { Platform } from 'react-native';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
} from '@expo-google-fonts/nunito';
import ExitScreen from './src/screens/ExitScreen';
import FacilityScreen from './src/screens/FacilityScreen';
import IntentWizard from './src/screens/IntentWizard';
import RoutePreviewScreen from './src/screens/RoutePreviewScreen';
import StationScreen from './src/screens/StationScreen';
import HelpScreen from './src/screens/HelpScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BottomNav from './src/components/nav/BottomNav';
import { loadTranslationCache } from './src/utils/translation';
import { LanguageProvider } from './src/context/LanguageContext';

import SplashScreen from './src/components/common/SplashScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const LIGHT_BG = '#F7F7FA';
const CARD_BG = '#FFFFFF';
const ACCENT = '#C8362A';
const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: ACCENT,
    background: LIGHT_BG,
    card: CARD_BG,
    text: '#111116',
    border: '#E8E8EE',
  },
};

const SCREEN_CONFIG = {
  screens: {
    Main: {
      screens: {
        Route: 'route',
        Station: 'station',
        Help: 'help',
        Settings: 'settings',
      },
    },
    RoutePreview: 'preview',
    Wizard: 'wizard',
    Exit: 'exit',
    Facility: 'facility',
  },
};

const linking = {
  prefixes: ['https://subway.seoulroutes.com', 'subway://'],
  config: SCREEN_CONFIG,
};



function MainTab() {
  return (
    <Tab.Navigator
      tabBar={props => <BottomNav {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Route" component={RoutePreviewScreen} />
      <Tab.Screen name="Station" component={StationScreen} />
      <Tab.Screen name="Help" component={HelpScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [isAppReady, setIsAppReady] = React.useState(false);

  const [fontsLoaded, fontError] = useFonts({
    'Nunito-Regular':   Nunito_400Regular,
    'Nunito-Medium':    Nunito_500Medium,
    'Nunito-SemiBold':  Nunito_600SemiBold,
    'Nunito-Bold':      Nunito_700Bold,
    'Nunito-ExtraBold': Nunito_800ExtraBold,
    'Pretendard-Regular': require('./assets/fonts/Pretendard-Regular.ttf'),
    'Pretendard-Medium':  require('./assets/fonts/Pretendard-Medium.ttf'),
    'Pretendard-Bold':    require('./assets/fonts/Pretendard-Bold.ttf'),
  });

  React.useEffect(() => {
    loadTranslationCache();

    // Show splash screen for at least 3 seconds
    const timer = setTimeout(() => {
      setIsAppReady(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    if (fontsLoaded) {
      console.log('DEBUG: Fonts loaded successfully ✓');
    }
    if (fontError) {
      console.warn('DEBUG: Font loading FAILED:', fontError);
    }
  }, [fontsLoaded, fontError]);

  const content = (!isAppReady || !fontsLoaded)
    ? <SplashScreen />
    : (
      <SafeAreaProvider>
      <NavigationContainer theme={navigationTheme} linking={linking}>
        <StatusBar style="dark" />
        <Stack.Navigator
          initialRouteName="Main"
          screenOptions={{
            headerStyle: { backgroundColor: LIGHT_BG },
            headerTintColor: '#1C1B1F',
            headerTitleStyle: { fontFamily: 'Nunito-Bold', fontWeight: '700', fontSize: 16, color: '#1C1B1F' },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen
            name="Main"
            component={MainTab}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RoutePreview"
            component={RoutePreviewScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Wizard"
            component={IntentWizard}
            options={{
              title: 'Your Intent',
            }}
          />
          <Stack.Screen
            name="Exit"
            component={ExitScreen}
            options={{
              title: '출구 안내',
              headerBackTitle: '뒤로',
            }}
          />
          <Stack.Screen
            name="Facility"
            component={FacilityScreen}
            options={{
              title: 'Station Facilities',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
    );

  return <LanguageProvider>{content}</LanguageProvider>;
}
