import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { isAxiosError } from './src/api/axios';
import RootNavigator from './src/navigation/RootNavigator';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (isAxiosError(error)) {
          const status = error.response?.status ?? 0;
          if (status === 401 || status === 403) return false;
        }
        return failureCount < 2;
      },
    },
  },
});

console.log('[App] APP STARTED');

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <RootNavigator />
        <Toast />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
