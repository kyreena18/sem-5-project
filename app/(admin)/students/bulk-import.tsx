import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, Upload, FileText, Users, Download } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface StudentData {
  name: string;
  uid: string;
  email: string;
  roll_no: string;
  department?: string;
  year?: string;
}

export default function BulkImportScreen() {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<StudentData[]>([]);

  const downloadTemplate = async () => {
    try {
      const templateData = [
        ['name', 'uid', 'email', 'roll_no', 'department', 'year'],
        ['John Doe', 'TYIT001', 'john.doe@college.edu', 'TYIT001', 'Computer Science', '3rd Year'],
        ['Jane Smith', 'TYSD002', 'jane.smith@college.edu', 'TYSD002', 'Computer Science', '3rd Year'],
        ['Mike Johnson', 'SYIT003', 'mike.johnson@college.edu', 'SYIT003', 'Computer Science', '2nd Year'],
      ];

      const worksheet = XLSX.utils.aoa_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');

      // Set column widths
      worksheet['!cols'] = [
        { wch: 20 }, // name
        { wch: 12 }, // uid
        { wch: 25 }, // email
        { wch: 12 }, // roll_no
        { wch: 18 }, // department
        { wch: 12 }, // year
      ];

      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'base64' });
      const filename = 'student_import_template.xlsx';
      const fileUri = FileSystem.documentDirectory + filename;
      
      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      await Sharing.shareAsync(fileUri);

      Alert.alert('Template Downloaded', 'Fill in the template with student data and upload it back.');
    } catch (error) {
      console.error('Template generation error:', error);
      Alert.alert('Error', 'Failed to generate template');
    }
  };

  const selectAndPreviewFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Skip header row and process data
      const students: StudentData[] = [];
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (row[0] && row[1] && row[2] && row[3]) { // Check required fields
          students.push({
            name: String(row[0]).trim(),
            uid: String(row[1]).trim(),
            email: String(row[2]).trim(),
            roll_no: String(row[3]).trim(),
            department: row[4] ? String(row[4]).trim() : 'Computer Science',
            year: row[5] ? String(row[5]).trim() : '1st Year',
          });
        }
      }

      if (students.length === 0) {
        Alert.alert('No Data', 'No valid student data found in the Excel file.');
        return;
      }

      setPreviewData(students);
      Alert.alert('Preview Ready', `Found ${students.length} students. Review the data and click Import to proceed.`);
    } catch (error) {
      console.error('File processing error:', error);
      Alert.alert('Error', 'Failed to process Excel file. Please check the format.');
    }
  };

  const importStudents = async () => {
    if (previewData.length === 0) {
      Alert.alert('No Data', 'Please select and preview an Excel file first.');
      return;
    }

    try {
      setImporting(true);

      // Check for duplicates in database more efficiently
      const { data: existingStudents } = await supabase
        .from('students')
        .select('uid, email, roll_no');

      const existingUIDs = new Set(existingStudents?.map(s => s.uid) || []);
      const existingEmails = new Set(existingStudents?.map(s => s.email) || []);

      // Filter out duplicates and validate data
      const newStudents = previewData.filter(student => 
        student.uid && student.email && student.roll_no && student.name &&
        !existingUIDs.has(student.uid) && 
        !existingEmails.has(student.email)
      );

      if (newStudents.length === 0) {
        Alert.alert('No New Students', 'All students in the file already exist in the database or have invalid data.');
        setImporting(false);
        return;
      }

      // Insert students one by one to handle individual errors
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const student of newStudents) {
        try {
          const { error } = await supabase
            .from('students')
            .insert({
              name: student.name,
              uid: student.uid,
              email: student.email,
              roll_no: student.roll_no,
              class: student.class || 'SYIT',
              total_credits: 0,
            });

          if (error) {
            errorCount++;
            errors.push(`${student.name} (${student.uid}): ${error.message}`);
          } else {
            successCount++;
          }
        } catch (err) {
          errorCount++;
          errors.push(`${student.name} (${student.uid}): Unknown error`);
        }
      }

      const duplicateCount = previewData.length - newStudents.length;
      let message = `Successfully imported ${successCount} students.`;
      if (duplicateCount > 0) message += ` ${duplicateCount} duplicates were skipped.`;
      if (errorCount > 0) message += ` ${errorCount} failed to import.`;
      
      Alert.alert('Import Complete', message);
      setPreviewData([]);
      router.back();
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Import Failed', 'Failed to import students. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ChevronLeft size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bulk Import Students</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.instructionsCard}>
          <FileText size={32} color="#007AFF" />
          <Text style={styles.instructionsTitle}>Import Students from Excel</Text>
          <Text style={styles.instructionsText}>
            Follow these steps to import student data in bulk:
          </Text>
          
          <View style={styles.stepsList}>
            <Text style={styles.stepText}>1. Download the Excel template</Text>
            <Text style={styles.stepText}>2. Fill in student data (name, uid, email, roll_no)</Text>
            <Text style={styles.stepText}>3. Upload the completed Excel file</Text>
            <Text style={styles.stepText}>4. Review and import the data</Text>
          </View>

          <TouchableOpacity style={styles.downloadTemplateButton} onPress={downloadTemplate}>
            <Download size={20} color="#FFFFFF" />
            <Text style={styles.downloadTemplateText}>Download Excel Template</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Upload Excel File</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={selectAndPreviewFile}>
            <Upload size={24} color="#007AFF" />
            <Text style={styles.uploadText}>Select Excel File</Text>
          </TouchableOpacity>
        </View>

        {previewData.length > 0 && (
          <View style={styles.previewCard}>
            <Text style={styles.previewTitle}>Preview Data ({previewData.length} students)</Text>
            <ScrollView style={styles.previewList} nestedScrollEnabled>
              {previewData.slice(0, 10).map((student, index) => (
                <View key={index} style={styles.previewItem}>
                  <Text style={styles.previewName}>{student.name}</Text>
                  <Text style={styles.previewDetails}>
                    {student.uid} • {student.email} • {student.roll_no}
                  </Text>
                </View>
              ))}
              {previewData.length > 10 && (
                <Text style={styles.moreText}>... and {previewData.length - 10} more students</Text>
              )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.importButton, importing && styles.disabledButton]}
              onPress={importStudents}
              disabled={importing}
            >
              <Users size={20} color="#FFFFFF" />
              <Text style={styles.importButtonText}>
                {importing ? 'Importing...' : `Import ${previewData.length} Students`}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.formatCard}>
          <Text style={styles.formatTitle}>Excel Format Requirements</Text>
          <View style={styles.formatList}>
            <Text style={styles.formatItem}>• Column A: name (Full Name)</Text>
            <Text style={styles.formatItem}>• Column B: uid (College UID)</Text>
            <Text style={styles.formatItem}>• Column C: email (College Email)</Text>
            <Text style={styles.formatItem}>• Column D: roll_no (Roll Number)</Text>
            <Text style={styles.formatItem}>• Column E: class (TYIT, TYSD, SYIT, or SYSD)</Text>
          </View>
          <Text style={styles.formatNote}>
            Note: First row should contain column headers. All fields are required. Class must be exactly one of: TYIT, TYSD, SYIT, SYSD. Duplicate UIDs and emails will be skipped automatically. Roll numbers can be duplicated across different classes.
          </Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)'
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  instructionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  instructionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  instructionsText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepsList: {
    alignSelf: 'stretch',
    marginBottom: 20,
  },
  stepText: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 8,
    paddingLeft: 8,
  },
  downloadTemplateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  downloadTemplateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  uploadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  previewList: {
    maxHeight: 200,
    marginBottom: 16,
  },
  previewItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  previewDetails: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  moreText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  formatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  formatTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  formatList: {
    marginBottom: 16,
  },
  formatItem: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 8,
  },
  formatNote: {
    fontSize: 12,
    color: '#6B6B6B',
    fontStyle: 'italic',
    lineHeight: 18,
  },
});