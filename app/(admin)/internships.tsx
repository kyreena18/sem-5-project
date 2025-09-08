import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

interface ClassStats {
  className: string;
  displayName: string;
  description: string;
  studentCount: number;
  color: string;
}

export default function AdminInternshipsScreen() {
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
        const mockStats = classDefinitions.map(def => ({ ...def, studentCount: def.className.startsWith('TY') ? 25 : 22 }));
        
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
    router.push(`/(admin)/internships/class/${className}`);
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading internship data...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Internship Management</Text>
        <View style={styles.headerStats}>
          <Text style={styles.headerStatsText}>{totalStudents} Students</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.overviewCard}>
          <View style={styles.overviewHeader}>
            <GraduationCap size={32} color="#007AFF" />
            <View style={styles.overviewInfo}>
              <Text style={styles.overviewTitle}>Internship Overview</Text>
              <Text style={styles.overviewSubtitle}>
                Manage student internship submissions across all classes
              </Text>
            </View>
          </View>
          <View style={styles.overviewStats}>
            <Text style={styles.totalStudents}>{totalStudents}</Text>
            <Text style={styles.totalLabel}>Total Students</Text>
          </View>
        </View>

        <View style={styles.assignmentsInfo}>
          <Text style={styles.sectionTitle}>Static Assignments</Text>
          <Text style={styles.sectionSubtitle}>
            All students have access to these 6 predefined assignments
          </Text>
          
          <View style={styles.assignmentsList}>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentName}>1. Offer Letter</Text>
              <Text style={styles.assignmentDesc}>Must be approved to unlock others</Text>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentName}>2. Completion Letter</Text>
              <Text style={styles.assignmentDesc}>Internship completion certificate</Text>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentName}>3. Weekly Report</Text>
              <Text style={styles.assignmentDesc}>Weekly progress reports</Text>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentName}>4. Student Outcome</Text>
              <Text style={styles.assignmentDesc}>Student outcome assessment</Text>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentName}>5. Student Feedback</Text>
              <Text style={styles.assignmentDesc}>Feedback about internship experience</Text>
            </View>
            <View style={styles.assignmentItem}>
              <Text style={styles.assignmentName}>6. Company Outcome</Text>
              <Text style={styles.assignmentDesc}>Company evaluation report</Text>
            </View>
          </View>
        </View>

        <View style={styles.classesSection}>
          <Text style={styles.sectionTitle}>Classes</Text>
          <Text style={styles.sectionSubtitle}>
            Select a class to view and manage student submissions
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
                <View style={styles.classFooter}>
                  <Text style={styles.viewStudentsText}>View Student Submissions</Text>
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
  assignmentsInfo: {
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
    marginBottom: 16,
  },
  assignmentsList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  assignmentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  assignmentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  assignmentDesc: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  classesSection: {
    marginBottom: 40,
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
});