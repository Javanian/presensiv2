import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Props {
  message?: string;
}

export default function LoadingScreen({ message = 'Loading...' }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.message}>{message}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
  },
});
