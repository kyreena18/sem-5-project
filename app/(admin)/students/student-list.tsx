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
      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock data for development
        const classDefinitions = [
          { className: 'TYIT', displayName: 'Third Year IT', description: 'Information Technology - Final Year', color: '#007AFF' },
          { className: 'TYSD', displayName: 'Third Year Software Development', description: 'Software Development - Final Year', color: '#34C759' },
          { className: 'SYIT', displayName: 'Second Year IT', description: 'Information Technology - Second Year', color: '#FF9500' },
          { className: 'SYSD', displayName: 'Second Year Software Development', description: 'Software Development - Second Year', color: '#AF52DE' }
        ];
        const mockStats = classDefinitions.map(def => ({ ...def, studentCount: def.className.startsWith('TY') ? 25 : 28 }));
        
        setClassStats(mockStats);
        setTotalStudents(mockStats.reduce((sum, cls) => sum + cls.studentCount, 0));
        setLoading(false);
        return;
      }

      // Real Supabase query
      const { data, error } = await supabase
        .from('student_profiles')
        .select('class')
        .not('class', 'is', null);

      if (error) throw error;

      // Count students by class
      const classCounts = (data || []).reduce((acc: { [key: string]: number }, student) => {
        const className = student.class;
        acc[className] = (acc[className] || 0) + 1;
        return acc;
      }, {});

      const classDefinitions = [
        { className: 'TYIT', displayName: 'Third Year IT', description: 'Information Technology - Final Year', color: '#007AFF' },
        { className: 'TYSD', displayName: 'Third Year Software Development', description: 'Software Development - Final Year', color: '#34C759' },
        { className: 'SYIT', displayName: 'Second Year IT', description: 'Information Technology - Second Year', color: '#FF9500' },
        { className: 'SYSD', displayName: 'Second Year Software Development', description: 'Software Development - Second Year', color: '#AF52DE' }
      ];

      const statsWithCounts = classDefinitions.map(classDef => ({
        ...classDef,
        studentCount: classCounts[classDef.className] || 0
      }));

      setClassStats(statsWithCounts);
      setTotalStudents(Object.values(classCounts).reduce((sum: number, count: number) => sum + count, 0));
    } catch (error) {
      console.error('Error loading class stats:', error);
      setClassStats([]);
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
          <Text style={styles.loadingText}>Loading student data...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Management</Text>
        <View style={styles.headerStats}>
          <Text style={styles.headerStatsText}>{totalStudents} Total</Text>
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

          <TouchableOpacity
            style={styles.bulkImportButton}
            onPress={() => router.push('/(admin)/students/bulk-import')}
          >
            <Text style={styles.bulkImportText}>Bulk Import Students from Excel</Text>
          </TouchableOpacity>

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
                <View style={styles.classFooter}>
                  <Text style={styles.viewStudentsText}>View Students</Text>
                  <ChevronRight size={16} color="#007AFF" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Class Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              • <Text style={styles.infoBold}>TYIT/TYSD</Text>: Third Year students (Final Year){'\n'}
              • <Text style={styles.infoBold}>SYIT/SYSD</Text>: Second Year students{'\n'}
              • <Text style={styles.infoBold}>IT</Text>: Information Technology{'\n'}
              • <Text style={styles.infoBold}>SD</Text>: Software Development{'\n\n'}
              Students are automatically organized by their class selection in their profile.
            </Text>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerStats: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerStatsText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  overviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  overviewInfo: {
    marginLeft: 16,
    flex: 1,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  overviewSubtitle: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  overviewStats: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    paddingVertical: 20,
  },
  totalStudents: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  classesSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 20,
  },
  classesList: {
    gap: 16,
  },
  classCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  classIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  classDisplayName: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
    marginBottom: 2,
  },
  classDescription: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  classStats: {
    alignItems: 'center',
  },
  studentCount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  studentLabel: {
    fontSize: 12,
    color: '#6B6B6B',
  },
  classFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F2F2F7',
  },
  viewStudentsText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 40,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 22,
  },
  infoBold: {
    fontWeight: '600',
    color: '#1C1C1E',
  },
  bulkImportButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  bulkImportText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});