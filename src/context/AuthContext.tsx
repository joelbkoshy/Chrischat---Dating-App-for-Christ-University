import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io, Socket } from 'socket.io-client';
import api, { SOCKET_URL } from '../services/api';
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
  const globalSocketRef = useRef<Socket | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  // Global socket: connect when user is set, disconnect on logout
  useEffect(() => {
    if (!user?._id) {
      globalSocketRef.current?.disconnect();
      globalSocketRef.current = null;
      return;
    }

    const socket = io(SOCKET_URL);
    globalSocketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('user_online', user._id);
    });

    socket.on('match_notification', (data: { matchId: string; user: { _id: string; name: string; photos?: string[] } }) => {
      Alert.alert(
        '🎉 New Match!',
        `You matched with ${data.user.name}! Start chatting now.`,
      );
    });

    socket.on('like_received', (data: { from: { _id: string; name: string } }) => {
      Alert.alert(
        '💜 Someone Likes You!',
        `${data.from.name} liked your profile! Like them back to match.`,
      );
    });

    socket.on('super_like_received', (data: { from: { _id: string; name: string; photos?: string[] } }) => {
      Alert.alert(
        '⭐ Super Like!',
        `${data.from.name} sent you a Super Like!`,
      );
    });

    return () => {
      socket.disconnect();
      globalSocketRef.current = null;
    };
  }, [user?._id]);

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
