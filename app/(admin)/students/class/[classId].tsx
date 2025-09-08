import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, User, Mail, Hash, FileText, Download } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface Student {
  id: string;
  name: string;
  uid: string;
  roll_no: string;
  email: string;
  class: string;
  total_credits: number;
}

export default function ClassStudentsView() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, [classId]);

  const loadStudents = async () => {
  if (!classId) return;

  try {
    setLoading(true);

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
      // Mock data
      const mockStudents: Student[] = [];
      const studentCount = String(classId).startsWith('TY') ? 25 : 22;

      for (let i = 1; i <= studentCount; i++) {
        const rollNo = i.toString(); // keep as number string
        mockStudents.push({
          id: `mock-student-${classId}-${i}`,
          name: `Student ${i} Full Name`,
          uid: `${classId}${rollNo.padStart(3, '0')}`,
          roll_no: rollNo,
          email: `student${i}@college.edu`,
          class: String(classId),
          total_credits: Math.floor(Math.random() * 10),
        });
      }

      mockStudents.sort((a, b) => Number(a.roll_no) - Number(b.roll_no));
      setStudents(mockStudents);
      setLoading(false);
      return;
    }

    // Real Supabase query
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('class', String(classId));

    if (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } else {
      const sorted = (data || []).sort(
        (a, b) => Number(a.roll_no) - Number(b.roll_no)
      );
      setStudents(sorted);
    }
    } catch (error) {
      console.error('Error loading students:', error);
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      const data = students.map((student, index) => ({
        'S.No': index + 1,
        'Name': student.name,
        'UID': student.uid,
        'Roll Number': student.roll_no,
        'Email': student.email,
        'Class': student.class,
        'Total Credits': student.total_credits,
      }));

      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      const colWidths = [
        { wch: 6 },  // S.No
        { wch: 25 }, // Name
        { wch: 15 }, // UID
        { wch: 15 }, // Roll Number
        { wch: 30 }, // Email
        { wch: 8 },  // Class
        { wch: 15 }, // Total Credits
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${classId} Students`);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${classId}_Students_${timestamp}.xlsx`;
      
      XLSX.writeFile(workbook, filename);
      
      Alert.alert('Success', `Excel report for ${classId} downloaded successfully!`);
    } catch (error) {
      console.error('Excel generation error:', error);
      Alert.alert('Error', 'Failed to generate Excel report');
    }
  };

  const getClassDisplayName = (className: string) => {
    const classNames: { [key: string]: string } = {
      'TYIT': 'Third Year Information Technology',
      'TYSD': 'Third Year Software Development',
      'SYIT': 'Second Year Information Technology',
      'SYSD': 'Second Year Software Development',
    };
    return classNames[className] || className;
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Class: {String(classId)}</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading students...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Class: {String(classId)}</Text>
        <TouchableOpacity style={styles.exportButton} onPress={exportToExcel}>
          <Download size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View style={styles.classInfo}>
        <Text style={styles.classDisplayName}>{getClassDisplayName(String(classId))}</Text>
        <Text style={styles.studentCountText}>{students.length} Students</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {students.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={64} color="#6B6B6B" />
            <Text style={styles.emptyStateTitle}>No Students Found</Text>
            <Text style={styles.emptyStateText}>
              No students are registered in {String(classId)} class yet.
            </Text>
          </View>
        ) : (
          <View style={styles.studentsList}>
            {students.map((student, index) => (
              <View key={student.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.studentAvatarText}>
                      {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>{student.name}</Text>
                    <View style={styles.studentDetails}>
                      <View style={styles.detailRow}>
                        <Hash size={14} color="#6B6B6B" />
                        <Text style={styles.detailText}>UID: {student.uid}</Text>
                      </View>
                      <View style={styles.detailRow}>
                        <FileText size={14} color="#6B6B6B" />
                        <Text style={styles.detailText}>Roll: {student.roll_no}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.creditsInfo}>
                    <Text style={styles.creditsNumber}>{student.total_credits}</Text>
                    <Text style={styles.creditsLabel}>Credits</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 40,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  exportButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
  },
  classInfo: {
    alignItems: 'center',
    marginBottom: 10,
  },
  classDisplayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  studentCountText: {
    fontSize: 13,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
  studentsList: {
    gap: 12,
    paddingBottom: 40,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentAvatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  studentDetails: {
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 13,
    color: '#6B6B6B',
    marginLeft: 6,
  },
  creditsInfo: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  creditsNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  creditsLabel: {
    fontSize: 11,
    color: '#6B6B6B',
  },
});
