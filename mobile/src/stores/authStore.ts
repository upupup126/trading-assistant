import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email: string) => Promise<boolean>;
  logout: () => Promise<void>;
  getProfile: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,

  login: async (username, password) => {
    set({ loading: true, error: null });
    try {
      const res = await api.login({ username, password });
      const { user, tokens } = res.data.data;
      const token = tokens.access_token;
      await SecureStore.setItemAsync('auth_token', token);
      set({ user, token, isAuthenticated: true, loading: false });
      return true;
    } catch (e: any) {
      const msg = e.response?.data?.error || '登录失败，请检查用户名和密码';
      set({ error: msg, loading: false });
      return false;
    }
  },

  register: async (username, password, email) => {
    set({ loading: true, error: null });
    try {
      await api.register({ username, password, email });
      set({ loading: false });
      return true;
    } catch (e: any) {
      const msg = e.response?.data?.error || '注册失败';
      set({ error: msg, loading: false });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.logout();
    } catch {}
    await SecureStore.deleteItemAsync('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  getProfile: async () => {
    try {
      const res = await api.getProfile();
      set({ user: res.data.data });
    } catch {}
  },

  restoreSession: async () => {
    const token = await SecureStore.getItemAsync('auth_token');
    if (!token) return;
    set({ token, loading: true });
    try {
      const res = await api.getProfile();
      set({ user: res.data.data, isAuthenticated: true, loading: false });
    } catch {
      await SecureStore.deleteItemAsync('auth_token');
      set({ token: null, loading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
