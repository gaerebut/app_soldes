import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../src/constants/theme';
import { createAisle } from '../src/database/aisles';

export default function SetupAislesScreen() {
  const router = useRouter();
  const [aisleName, setAisleName] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const name = aisleName.trim();
    if (!name) {
      Alert.alert('Nom requis', 'Veuillez saisir le nom du rayon.');
      return;
    }
    setSaving(true);
    try {
      await createAisle(name);
      router.replace('/');
    } catch {
      Alert.alert('Erreur', 'Impossible de créer le rayon. Vérifiez votre connexion.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Icône */}
        <View style={styles.iconCircle}>
          <Ionicons name="storefront-outline" size={48} color="#E3001B" />
        </View>

        {/* Titre */}
        <Text style={styles.title}>Créer votre premier rayon</Text>
        <Text style={styles.subtitle}>
          Pour commencer à utiliser DLC Manager, vous devez créer au moins un rayon.
          Les produits y seront obligatoirement rattachés.
        </Text>

        {/* Champ */}
        <Text style={styles.label}>Nom du rayon *</Text>
        <TextInput
          style={styles.input}
          placeholder="Ex : Crèmerie, Charcuterie, Boulangerie…"
          placeholderTextColor={Colors.textLight}
          value={aisleName}
          onChangeText={setAisleName}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />

        {/* Bouton */}
        <TouchableOpacity
          style={[styles.button, saving && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#FFF" />
              <Text style={styles.buttonText}>Créer le rayon</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFF3F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 32,
  },
  label: {
    alignSelf: 'flex-start',
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    width: '100%',
    backgroundColor: Colors.card,
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: 24,
  },
  button: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E3001B',
    padding: 16,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#E3001B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
