import '../global.css';
import '../nativewind-interop';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { IBMPlexSansThai_400Regular } from '@expo-google-fonts/ibm-plex-sans-thai';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Text } from 'react-native';

// Belt-and-suspenders: any bare <Text> with no style falls back to NotoSansThai so stray Thai
// never renders in the system font. `Body` (DESIGN_SYSTEM §3.4) is the documented path; this
// just catches the strays. (NativeWind-styled Text already carries its own fontFamily.)
const TextWithDefaults = Text as unknown as { defaultProps?: { style?: unknown } };
TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
TextWithDefaults.defaultProps.style = { fontFamily: 'IBMPlexSansThai_400Regular' };

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    IBMPlexSansThai_400Regular,
    IBMPlexMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="analyzing" />
      <Stack.Screen name="results" />
      <Stack.Screen name="claim" />
      <Stack.Screen name="details" />
      <Stack.Screen name="documents" />
    </Stack>
  );
}
