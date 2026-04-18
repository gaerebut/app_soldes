import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_AISLE_KEY = 'dlc_last_selected_aisle';

export async function saveLastSelectedAisle(aisleId: number | null): Promise<void> {
  try {
    if (aisleId === null) {
      await AsyncStorage.removeItem(LAST_AISLE_KEY);
    } else {
      await AsyncStorage.setItem(LAST_AISLE_KEY, aisleId.toString());
    }
  } catch (err) {
    console.error('Failed to save last aisle:', err);
  }
}

export async function getLastSelectedAisle(): Promise<number | null> {
  try {
    const value = await AsyncStorage.getItem(LAST_AISLE_KEY);
    return value ? parseInt(value, 10) : null;
  } catch (err) {
    console.error('Failed to get last aisle:', err);
    return null;
  }
}
