import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setUnauthorizedHandler, getServerUrl } from '../api/client';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

const TOKEN_KEY = 'dlc_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(TOKEN_KEY).then(async (stored) => {
      if (stored) {
        // Vérifier si le token est toujours valide
        try {
          const serverUrl = await getServerUrl();
          const res = await fetch(`${serverUrl}/api/devices`, {
            headers: { 'Authorization': `Bearer ${stored}` },
          });
          if (res.status !== 401) {
            setToken(stored);
          } else {
            // Token invalide ou expiré, on nettoie
            await AsyncStorage.removeItem(TOKEN_KEY);
          }
        } catch {
          // Pas de réseau, on garde le token et on laisse l'app gérer
          setToken(stored);
        }
      }
      setIsLoading(false);
    });
    setUnauthorizedHandler(() => setToken(null));
  }, []);

  const login = async (newToken: string) => {
    await AsyncStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  };

  const logout = async () => {
    await AsyncStorage.removeItem(TOKEN_KEY);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
