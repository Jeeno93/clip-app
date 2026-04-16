import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getRandomClip } from "../storage/clips";

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleDailyDigest(hour: number): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();

    const clip = await getRandomClip();
    const body = clip
      ? clip.text.slice(0, 60) + (clip.text.length > 60 ? "..." : "")
      : "Открой своё лучшее — сегодня";

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Твои открытия",
        body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
      },
    });
  } catch {
  }
}

export async function cancelDailyDigest(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
  }
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
