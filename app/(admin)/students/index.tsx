import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Users, GraduationCap, ChevronRight } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

interface ClassStats {
  className: string;
  displayName: string;
  description: string;
  studentCount: number;
  color: string;
}

export default function AdminStudentsScreen() {
  const router = useRouter();
  const [classStats, setClassStats] = useState<ClassStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStudents, setTotalStudents] = useState(0);

  useEffect(() => {
    loadClassStats();
  }, []);

  const loadClassStats = async () => {
    try {
      setLoading(true);

      const classDefinitions = [
        { className: 'TYIT', displayName: 'Third Year IT', description: 'Information Technology - Final Year', color: '#007AFF' },
        { className: 'TYSD', displayName: 'Third Year Software Development', description: 'Software Development - Final Year', color: '#34C759' },
        { className: 'SYIT', displayName: 'Second Year IT', description: 'Information Technology - Second Year', color: '#FF9500' },
        { className: 'SYSD', displayName: 'Second Year Software Development', description: 'Software Development - Second Year', color: '#AF52DE' }
      ];

      // If Supabase isn't configured, use mock data
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        const mockStats = classDefinitions.map(def => ({
          ...def,
          studentCount: def.className.startsWith('TY') ? 25 : 28
        }));
        setClassStats(mockStats);
        setTotalStudents(mockStats.reduce((s, c) => s + c.studentCount, 0));
        return;
      }

      // Real DB fetch: get all rows with the class field
      const { data, error } = await supabase
        .from('student_profiles')
        .select('class');

      if (error) throw error;

      // Build counts grouped by class (normalize to uppercase)
      const classCounts: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const cls = row?.class;
        if (!cls) return;
        const key = String(cls).toUpperCase();
        classCounts[key] = (classCounts[key] || 0) + 1;
      });

      // Map counts into your known class definitions
      const statsWithCounts: ClassStats[] = classDefinitions.map(def => ({
        ...def,
        studentCount: classCounts[def.className] || 0
      }));

      // totalStudents should reflect all counted rows (including any classes outside definitions)
      const total = Object.values(classCounts).reduce((s, n) => s + (Number(n) || 0), 0);

      setClassStats(statsWithCounts);
      setTotalStudents(total);
    } catch (err) {
      console.error('Error loading class stats:', err);
      setClassStats([]);
      setTotalStudents(0);
    } finally {
      setLoading(false);
    }
  };

  const navigateToClass = (className: string) => {
    router.push(`/(admin)/students/class/${className}`);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Management</Text>
        <View style={styles.headerRight}>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatsText}>{totalStudents} Total</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <Users size={32} color="#007AFF" />
            <View style={styles.overviewInfo}>
              <Text style={styles.overviewTitle}>Student Overview</Text>
              <Text style={styles.overviewSubtitle}>
                Manage students across all classes
              </Text>
            </View>
          </View>
          <View style={styles.overviewStats}>
            <Text style={styles.totalStudents}>{totalStudents}</Text>
            <Text style={styles.totalLabel}>Total Students</Text>
          </View>
        </View>

        <View style={styles.classesSection}>
          <Text style={styles.sectionTitle}>Classes</Text>
          <Text style={styles.sectionSubtitle}>
            Select a class to view and manage students
          </Text>

          <View style={styles.classesList}>
            {classStats.map((classItem) => (
              <TouchableOpacity
                key={classItem.className}
                style={styles.classCard}
                onPress={() => navigateToClass(classItem.className)}
              >
                <View style={styles.classHeader}>
                  <View style={[styles.classIcon, { backgroundColor: classItem.color }]}>
                    <GraduationCap size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{classItem.className}</Text>
                    <Text style={styles.classDisplayName}>{classItem.displayName}</Text>
                    <Text style={styles.classDescription}>{classItem.description}</Text>
                  </View>
                  <View style={styles.classStats}>
                    <Text style={styles.studentCount}>{classItem.studentCount}</Text>
                    <Text style={styles.studentLabel}>Students</Text>
                  </View>
                </View>
                <View style={styles.viewStudentsButton}>
                  <Text style={styles.viewStudentsText}>View Students</Text>
                  <ChevronRight size={16} color="#007AFF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulkImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bulkImportText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
  headerStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  headerStatsText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  overviewInfo: {
    marginLeft: 12,
    flex: 1,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  overviewSubtitle: {
    fontSize: 13,
    color: '#6B6B6B',
  },
  overviewStats: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingVertical: 16,
  },
  totalStudents: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 2,
  },
  totalLabel: {
    fontSize: 13,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  classesSection: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 14,
  },
  classesList: {
    gap: 14,
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  classIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  classDisplayName: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  classDescription: {
    fontSize: 12,
    color: '#6B6B6B',
    flexWrap: 'wrap',
  },
  classStats: {
    alignItems: 'center',
  },
  studentCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  studentLabel: {
    fontSize: 11,
    color: '#6B6B6B',
  },
  viewStudentsButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  viewStudentsText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});
