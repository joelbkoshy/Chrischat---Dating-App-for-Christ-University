import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { getOrCreateKeyPair } from '../services/crypto';

interface User {
  _id: string;
  name: string;
  email: string;
  department: string;
  isProfileComplete: boolean;
  token?: string;
  age?: number;
  gender?: string;
  bio?: string;
  photos?: string[];
  interests?: string[];
  year?: string;
  campus?: string;
  interestedIn?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, department: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const initE2EEKeys = async () => {
    try {
      const keyPair = await getOrCreateKeyPair();
      await api.uploadPublicKey(keyPair.publicKey);
    } catch (e) {
      console.warn('E2EE key init failed:', e);
    }
  };

  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const savedUser = await AsyncStorage.getItem('user');

      if (token && savedUser) {
        await api.setToken(token);
        setUser(JSON.parse(savedUser));
        initE2EEKeys();
      }
    } catch {
      // token invalid or expired
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const data = await api.login({ email, password });
    await api.setToken(data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    initE2EEKeys();
  };

  const register = async (name: string, email: string, password: string, department: string) => {
    const data = await api.register({ name, email, password, department });
    await api.setToken(data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data));
    setUser(data);
    initE2EEKeys();
  };

  const logout = async () => {
    await api.clearToken();
    setUser(null);
  };

  const updateUser = (data: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...data };
      AsyncStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}
