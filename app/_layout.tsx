import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { debugSupabaseConfig } from '@/lib/supabase';

export default function RootLayout() {
  useFrameworkReady();
  
  // Ensure environment variables are loaded
  useEffect(() => {
    // Debug Supabase configuration on app start
    debugSupabaseConfig();
    
    if (!process.env.EXPO_PUBLIC_SUPABASE_URL) {
      console.warn('EXPO_PUBLIC_SUPABASE_URL not found, using fallback');
    }
  }, []);
  
  return (
    
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'Campus Connect' }} />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(student)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </AuthProvider>
  );
}