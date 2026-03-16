import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import SplashScreen from '../screens/SplashScreen';
import MainNavigator from './MainNavigator';
import AuthNavigator from './AuthNavigator';
import { getAuthState, subscribeToAuthState } from '../store/authStore';

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const [authState, setAuthState] = useState(getAuthState);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(setAuthState);
    return unsubscribe;
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{ headerShown: false, animation: 'none' }}
      >
        {!authState.isInitialized ? (
          <Stack.Screen name="Splash" component={SplashScreen} />
        ) : authState.isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
