import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/theme';
import { useAuth } from '../src/auth/AuthContext';
import { apiClient } from '../src/api/client';
import { getOrCreateDeviceId, getDeviceName, setDeviceName } from '../src/utils/device';

export default function LoginScreen() {
  const { login } = useAuth();
  const [deviceName, setDeviceNameState] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    getDeviceName().then((name) => {
      setDeviceNameState(name === 'Appareil mobile' ? '' : name);
      setInitialLoading(false);
    });
  }, []);

  const handleContinue = async () => {
    const trimmed = deviceName.trim();
    if (!trimmed) {
      Alert.alert('Nom requis', 'Veuillez donner un nom à cet appareil.');
      return;
    }

    setLoading(true);
    try {
      await setDeviceName(trimmed);
      const deviceId = await getOrCreateDeviceId();
      const result = await apiClient.loginAsDevice(deviceId, trimmed);
      if (result.token) {
        await login(result.token);
      } else {
        Alert.alert('Erreur', result.error || 'Impossible de se connecter.');
      }
    } catch {
      Alert.alert('Erreur de connexion', 'Impossible de contacter le serveur. Vérifiez votre connexion réseau.');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name="calendar" size={40} color="#FFF" />
          </View>
          <Text style={styles.title}>DLC Manager</Text>
          <Text style={styles.subtitle}>Gestion des dates de peremption</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Nom de cet appareil</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="phone-portrait-outline" size={20} color={Colors.textLight} />
            <TextInput
              style={styles.input}
              placeholder="Ex : Gaetan, Cuisine, iPad..."
              placeholderTextColor={Colors.textLight}
              value={deviceName}
              onChangeText={setDeviceNameState}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleContinue}
              autoFocus
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleContinue}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Ionicons name="arrow-forward-outline" size={22} color="#FFF" />
                <Text style={styles.loginButtonText}>Continuer</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E3001B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#E3001B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  form: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3001B',
    padding: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 24,
    shadowColor: '#E3001B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
