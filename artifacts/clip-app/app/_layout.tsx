import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { ShareIntentProvider, useShareIntentContext } from "expo-share-intent";
import React, { useEffect, useRef } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ClipsProvider } from "../src/context/ClipsContext";
import { ThemeProvider } from "../src/context/ThemeContext";
import { getSettings } from "../src/storage/clips";

SplashScreen.preventAutoHideAsync();

async function checkOnboarding() {
  try {
    const settings = await getSettings();
    if (!settings.onboardingDone) {
      router.replace("/onboarding");
    }
  } catch {}
}

/**
 * Watches for incoming Share Intents and navigates to AddClipScreen.
 * Must be inside ShareIntentProvider.
 */
function ShareIntentHandler() {
  const { hasShareIntent, shareIntent, resetShareIntent } =
    useShareIntentContext();
  const handledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) return;

    const imageUri = shareIntent?.files?.[0]?.path ?? null;
    const text = shareIntent?.text ?? shareIntent?.webUrl ?? null;

    // Build a stable de-dup key for this intent
    const key = imageUri ?? text;
    if (!key) return;
    if (handledRef.current === key) return;
    handledRef.current = key;

    if (imageUri) {
      router.push({
        pathname: "/add",
        params: { imageUri, source: "screenshot" },
      });
    } else if (text) {
      const source =
        shareIntent?.meta?.title ??
        (shareIntent?.webUrl ? "weburl" : "share");

      router.push({
        pathname: "/add",
        params: { sharedText: text, source },
      });
    }

    // Reset after navigation so the next share opens fresh
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);

  return null;
}

function RootLayoutNav() {
  useEffect(() => {
    checkOnboarding();
  }, []);

  return (
    <>
      {/* Handles share intent navigation — renders nothing visually */}
      <ShareIntentHandler />

      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, animation: "none" }}
        />
        <Stack.Screen
          name="add"
          options={{
            headerShown: false,
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="clip/[id]"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            headerShown: false,
            animation: "slide_from_right",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardProvider>
            {/*
             * ShareIntentProvider must wrap the navigation tree.
             * On web it is disabled automatically since the native
             * module is not available there.
             */}
            <ShareIntentProvider
              options={{ disabled: Platform.OS === "web" }}
            >
              <ThemeProvider>
                <ClipsProvider>
                  <RootLayoutNav />
                </ClipsProvider>
              </ThemeProvider>
            </ShareIntentProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
