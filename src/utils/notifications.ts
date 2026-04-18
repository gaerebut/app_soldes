import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Import notifications safely - may not be available in all environments
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (error) {
  console.warn('expo-notifications not available:', error);
}

const STORAGE_KEY = 'notification_settings';

export interface NotificationSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
};

// Configure how notifications appear when app is in foreground
// Only if notifications are available
if (Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('Failed to set notification handler:', error);
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Notifications) {
    console.warn('Notifications not available');
    return false;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('Failed to request notification permission:', error);
    return false;
  }
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to get notification settings:', error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Failed to save notification settings:', error);
  }
}

export async function scheduleDaily(hour: number, minute: number): Promise<void> {
  if (!Notifications) {
    console.warn('Notifications not available');
    return;
  }

  try {
    // Cancel existing notifications first
    await Notifications.cancelAllScheduledNotificationsAsync();

    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('dlc-reminder', {
          name: 'Rappel DLC',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
        });
      } catch (error) {
        console.warn('Failed to set notification channel:', error);
      }
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '📋 DLC Manager',
        body: "N'oubliez pas de contrôler les dates d'expiration aujourd'hui !",
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: 'dlc-reminder' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  } catch (error) {
    console.warn('Failed to schedule daily notification:', error);
  }
}

export async function cancelNotifications(): Promise<void> {
  if (!Notifications) {
    console.warn('Notifications not available');
    return;
  }

  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('Failed to cancel notifications:', error);
  }
}

export async function applyNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await saveNotificationSettings(settings);
    if (settings.enabled) {
      const granted = await requestNotificationPermission();
      if (granted) {
        await scheduleDaily(settings.hour, settings.minute);
      }
    } else {
      await cancelNotifications();
    }
  } catch (error) {
    console.warn('Failed to apply notification settings:', error);
  }
}
