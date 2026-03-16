import * as SecureStore from 'expo-secure-store';
import { TokenResponse, UserInfo } from '../types/auth';

export const TOKEN_KEYS = {
  ACCESS: 'presensiv2_access_token',
  REFRESH: 'presensiv2_refresh_token',
} as const;

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
}

let state: AuthState = {
  user: null,
  isAuthenticated: false,
  isInitialized: false,
};

type Listener = (state: AuthState) => void;
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((listener) => listener({ ...state }));
}

export function getAuthState(): AuthState {
  return { ...state };
}

export function subscribeToAuthState(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAuthUser(user: UserInfo | null): void {
  state = {
    user,
    isAuthenticated: user !== null,
    isInitialized: true,
  };
  notify();
}

export function setInitialized(isAuthenticated: boolean): void {
  state = {
    ...state,
    isAuthenticated,
    isInitialized: true,
  };
  notify();
}

export async function persistTokens(tokens: TokenResponse): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, tokens.access_token),
    SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, tokens.refresh_token),
  ]);
}

export async function getStoredTokens(): Promise<{
  access: string | null;
  refresh: string | null;
}> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(TOKEN_KEYS.ACCESS),
    SecureStore.getItemAsync(TOKEN_KEYS.REFRESH),
  ]);
  return { access, refresh };
}

export async function clearTokens(): Promise<void> {
  const stack = new Error('clearTokens called').stack ?? '(no stack)';
  console.log('[authStore] clearTokens() —', stack);
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS),
    SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH),
  ]);
  state = {
    user: null,
    isAuthenticated: false,
    isInitialized: true,
  };
  notify();
}
