import { Tabs } from 'expo-router';
import { Chrome as Home, User, Building, GraduationCap } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function StudentLayout() {
  const { user } = useAuth();
  const [studentClass, setStudentClass] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudentClass();
  }, [user]);

  const loadStudentClass = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock data - assume TYIT for demo
        setStudentClass('TYIT');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('students')
        .select('class')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.class) {
        setStudentClass(data.class);
      }
    } catch (error) {
      console.error('Error loading student class:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if student is eligible for placements (TYIT or TYSD only)
  const isPlacementEligible = studentClass === 'TYIT' || studentClass === 'TYSD';

  if (loading) {
    return null; // Or a loading spinner
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E5EA',
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: '#6B6B6B',
      }}
    >
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      {isPlacementEligible && (
        <Tabs.Screen
          name="placements"
          options={{
            title: 'Placements',
            tabBarIcon: ({ size, color }) => (
              <Building size={size} color={color} />
            ),
          }}
        />
      )}
      <Tabs.Screen
        name="internships"
        options={{
          title: 'Internships',
          tabBarIcon: ({ size, color }) => (
            <GraduationCap size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
