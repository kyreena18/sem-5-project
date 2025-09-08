import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, FileText, Award, CircleCheck as CheckCircle, Download } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { STATIC_ASSIGNMENTS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import * as FileSaver from 'file-saver';

interface StudentProfile {
  id: string;
  student_id: string;
  full_name: string;
  uid: string;
  roll_no: string;
  class: string;
}

interface StudentSubmission {
  assignment_type: string;
  file_url: string;
  submission_status: string;
  submitted_at: string;
  admin_feedback?: string;
}

interface StudentApproval {
  student_id: string;
  offer_letter_approved: boolean;
  credits_awarded: boolean;
}

export default function ClassView() {
  const router = useRouter();
  const { classId } = useLocalSearchParams<{ classId: string }>();

  const [profiles, setProfiles] = useState<StudentProfile[]>([]);
  const [submissions, setSubmissions] = useState<{ [studentId: string]: StudentSubmission[] }>({});
  const [approvals, setApprovals] = useState<{ [studentId: string]: StudentApproval }>({});
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [classId]);

  const loadData = async () => {
    if (!classId) return;
    try {
      setLoading(true);

      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock data for development
        const mockProfiles: StudentProfile[] = [];
        const studentCount = String(classId).startsWith('TY') ? 25 : 22;
        
        for (let i = 1; i <= studentCount; i++) {
          const rollNo = `${classId}${i.toString().padStart(3, '0')}`;
          mockProfiles.push({
            id: `mock-profile-${classId}-${i}`,
            student_id: `mock-student-${classId}-${i}`,
            full_name: `Student ${i} Full Name`,
            uid: rollNo,
            roll_no: rollNo,
            class: String(classId),
          });
        }

        setProfiles(mockProfiles);
        setSubmissions({});
        setApprovals({});
        setLoading(false);
        return;
      }

      // Load student profiles
      const { data: profs, error: profsError } = await supabase
        .from('student_profiles')
        .select('id, student_id, full_name, uid, roll_no, class')
        .eq('class', String(classId));

      if (profsError) {
        console.error('Error loading profiles:', profsError);
        setProfiles([]);
        setLoading(false);
        return;
      }

      setProfiles(profs || []);

      if (profs && profs.length > 0) {
        const studentIds = profs.map(p => p.student_id);

        // Load submissions
        const { data: subs, error: subsError } = await supabase
          .from('student_internship_submissions')
          .select('*')
          .in('student_id', studentIds);

        if (subsError) {
          console.error('Error loading submissions:', subsError);
          setSubmissions({});
        } else {
          const submissionsByStudent: { [studentId: string]: StudentSubmission[] } = {};
          (subs || []).forEach(sub => {
            if (!submissionsByStudent[sub.student_id]) {
              submissionsByStudent[sub.student_id] = [];
            }
            submissionsByStudent[sub.student_id].push(sub);
          });
          setSubmissions(submissionsByStudent);

          // Check for students who had approval but no longer have offer letter
          const studentsWithOfferLetter = new Set();
          (subs || []).forEach(sub => {
            if (sub.assignment_type === 'offer_letter') {
              studentsWithOfferLetter.add(sub.student_id);
            }
          });

          // Reset approval for students without offer letter
          for (const studentId of studentIds) {
            if (!studentsWithOfferLetter.has(studentId)) {
              await supabase
                .from('student_internship_approvals')
                .update({ offer_letter_approved: false })
                .eq('student_id', studentId);
            }
          }

          // Check for students who should have credits reset
          const studentsEligibleForCredits = new Set();
          (subs || []).forEach(sub => {
            if (sub.assignment_type === 'completion_letter' && sub.submission_status === 'approved') {
              studentsEligibleForCredits.add(sub.student_id);
            }
          });

          // Reset credits for students without approved completion letter
          for (const studentId of studentIds) {
            if (!studentsEligibleForCredits.has(studentId)) {
              await supabase
                .from('student_internship_approvals')
                .update({ credits_awarded: false })
                .eq('student_id', studentId);
            }
          }
        }

        // Load approvals
        const { data: apps, error: appsError } = await supabase
          .from('student_internship_approvals')
          .select('*')
          .in('student_id', studentIds);

        if (appsError) {
          console.error('Error loading approvals:', appsError);
          setApprovals({});
        } else {
          const approvalsByStudent: { [studentId: string]: StudentApproval } = {};
          (apps || []).forEach(app => {
            approvalsByStudent[app.student_id] = app;
          });
          setApprovals(approvalsByStudent);
        }
      }
    } catch (err) {
      console.error('Error loading class view:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    try {
      const data = profiles.map((profile, index) => {
        const studentSubmissions = submissions[profile.student_id] || [];
        const approval = approvals[profile.student_id];
        
        const row: any = {
          'S.No': index + 1,
          'Roll Number': profile.roll_no,
          'Full Name': profile.full_name,
          'Class': profile.class,
          'UID': profile.uid,
        };

        // Add document columns
        STATIC_ASSIGNMENTS.forEach(assignment => {
          const submission = studentSubmissions.find(sub => sub.assignment_type === assignment.type);
          if (submission?.file_url) {
            row[assignment.title] = `=HYPERLINK("${submission.file_url}","View ${assignment.title}")`;
          } else {
            row[assignment.title] = 'Not Submitted';
          }
        });

        row['Offer Letter Approved'] = approval?.offer_letter_approved ? 'Yes' : 'No';
        row['Credits Awarded'] = approval?.credits_awarded ? 'Yes (2 Credits)' : 'No';

        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Set column widths
      const colWidths = [
        { wch: 6 },  // S.No
        { wch: 15 }, // Roll Number
        { wch: 25 }, // Full Name
        { wch: 8 },  // Class
        { wch: 15 }, // UID
        { wch: 20 }, // Offer Letter
        { wch: 22 }, // Completion Letter
        { wch: 18 }, // Weekly Report
        { wch: 20 }, // Student Outcome
        { wch: 20 }, // Student Feedback
        { wch: 20 }, // Company Outcome
        { wch: 20 }, // Offer Letter Approved
        { wch: 18 }  // Credits Awarded
      ];
      worksheet['!cols'] = colWidths;

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, `${classId} Students`);
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${classId}_Internship_Report_${timestamp}.xlsx`;
      
      // For web environment, use XLSX.writeFile
      XLSX.writeFile(workbook, filename);
      
      Alert.alert('Success', `Excel report for ${classId} downloaded successfully!`);
    } catch (error) {
      console.error('Excel generation error:', error);
      Alert.alert('Error', 'Failed to generate Excel report');
    }
  };

  const downloadAllDocuments = async (assignmentType: string) => {
    try {
      setDownloading(assignmentType);
      
      const assignment = STATIC_ASSIGNMENTS.find(a => a.type === assignmentType);
      if (!assignment) return;

      // Collect all file URLs for this assignment type
      const fileUrls: { url: string; studentName: string; rollNo: string }[] = [];
      
      profiles.forEach(profile => {
        const submission = getStudentSubmission(profile.student_id, assignmentType);
        if (submission?.file_url) {
          fileUrls.push({
            url: submission.file_url,
            studentName: profile.full_name,
            rollNo: profile.roll_no
          });
        }
      });

      if (fileUrls.length === 0) {
        Alert.alert('No Documents', `No ${assignment.title} documents found to download.`);
        return;
      }

      const zip = new JSZip();
      let downloadCount = 0;

      // Download each file and add to zip
      for (const fileData of fileUrls) {
        try {
          const response = await fetch(fileData.url);
          if (response.ok) {
            const blob = await response.blob();
            const fileExtension = fileData.url.split('.').pop() || 'pdf';
            const fileName = `${fileData.rollNo}_${fileData.studentName.replace(/[^a-zA-Z0-9]/g, '_')}.${fileExtension}`;
            zip.file(fileName, blob);
            downloadCount++;
          }
        } catch (error) {
          console.error(`Failed to download file for ${fileData.studentName}:`, error);
        }
      }

      if (downloadCount === 0) {
        Alert.alert('Download Failed', 'Could not download any documents.');
        return;
      }

      // Generate and download zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFileName = `${classId}_${assignment.title.replace(/\s+/g, '_')}_${timestamp}.zip`;
      
      FileSaver.default.saveAs(zipBlob, zipFileName);
      
      Alert.alert('Success', `Downloaded ${downloadCount} ${assignment.title} documents in ${zipFileName}`);
    } catch (error) {
      console.error('Bulk download error:', error);
      Alert.alert('Error', `Failed to download ${assignment?.title} documents.`);
    } finally {
      setDownloading(null);
    }
  };

  const getStudentSubmission = (studentId: string, assignmentType: string) => {
    const studentSubs = submissions[studentId] || [];
    return studentSubs.find(sub => sub.assignment_type === assignmentType);
  };

  const viewSubmission = async (studentId: string, assignmentType: string, title: string) => {
    const submission = getStudentSubmission(studentId, assignmentType);
    if (!submission?.file_url) {
      Alert.alert('No Document', `${title} not uploaded by the student yet.`);
      return;
    }
    try {
      // Open the URL directly - it should now display inline
      if (Platform.OS === 'web') {
        window.open(submission.file_url, '_blank');
      } else {
        await Linking.openURL(submission.file_url);
      }
    } catch (error) {
      Alert.alert('Error', `Failed to open ${title}.`);
    }
  };

  const approveOfferLetter = async (studentId: string) => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock approval for development
        setApprovals(prev => ({
          ...prev,
          [studentId]: { student_id: studentId, offer_letter_approved: true, credits_awarded: false }
        }));
        Alert.alert('Approved', 'Student offer letter approved. They can now submit other documents.');
        return;
      }

      const { error: approvalError } = await supabase
        .from('student_internship_approvals')
        .upsert({
          student_id: studentId,
          offer_letter_approved: true,
          approved_at: new Date().toISOString(),
        }, { onConflict: 'student_id' });

      if (approvalError) throw approvalError;

      const { error: submissionError } = await supabase
        .from('student_internship_submissions')
        .update({ 
          submission_status: 'approved', 
          admin_feedback: 'Offer letter approved - you can now submit other documents'
        })
        .eq('student_id', studentId)
        .eq('assignment_type', 'offer_letter');

      if (submissionError) console.error('Submission update error:', submissionError);

      setApprovals(prev => ({
        ...prev,
        [studentId]: { 
          student_id: studentId, 
          offer_letter_approved: true, 
          credits_awarded: prev[studentId]?.credits_awarded || false 
        }
      }));

      loadData();
      Alert.alert('Approved', 'Student offer letter approved. They can now submit other documents.');
    } catch (error) {
      console.error('Approval error:', error);
      Alert.alert('Error', 'Failed to approve student offer letter.');
    }
  };

  const awardCredits = async (profile: StudentProfile) => {
    try {
      // Check if credits already awarded
      if (approvals[profile.student_id]?.credits_awarded) {
        Alert.alert('Already Awarded', 'Credits have already been awarded to this student.');
        return;
      }

      // Check if completion letter exists and is submitted
      const completionSubmission = getStudentSubmission(profile.student_id, 'completion_letter');
      if (!completionSubmission?.file_url) {
        Alert.alert('Missing Document', 'Student must submit completion letter before credits can be awarded.');
        return;
      }

      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock credit awarding for development
        setApprovals(prev => ({
          ...prev,
          [profile.student_id]: { 
            student_id: profile.student_id, 
            offer_letter_approved: prev[profile.student_id]?.offer_letter_approved || false, 
            credits_awarded: true 
          }
        }));
        Alert.alert('Credits Awarded', '2 credits have been awarded to this student.');
        return;
      }

      // First, get the current student data
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('id, total_credits')
        .eq('id', profile.student_id)
        .single();

      if (studentError) {
        console.error('Error finding student:', studentError);
        Alert.alert('Error', 'Could not find student record.');
        return;
      }

      // Calculate new credits
      const currentCredits = studentData.total_credits || 0;
      const newCredits = currentCredits + 2;

      // Update student credits first
      const { error: creditsError } = await supabase
        .from('students')
        .update({ total_credits: newCredits })
        .eq('id', profile.student_id);

      if (creditsError) {
        console.error('Error updating credits:', creditsError);
        Alert.alert('Error', 'Failed to update student credits.');
        return;
      }

      // Then update the approval record
      const { error: approvalError } = await supabase
        .from('student_internship_approvals')
        .upsert({
          student_id: profile.student_id,
          credits_awarded: true,
          credits_awarded_at: new Date().toISOString(),
          offer_letter_approved: approvals[profile.student_id]?.offer_letter_approved || false,
        }, { 
          onConflict: 'student_id'
        });

      if (approvalError) throw approvalError;

      // Update completion letter submission status to approved
      const { error: submissionError } = await supabase
        .from('student_internship_submissions')
        .update({ 
          submission_status: 'approved',
          admin_feedback: '2 credits awarded for internship completion'
        })
        .eq('student_id', profile.student_id)
        .eq('assignment_type', 'completion_letter');

      if (submissionError) {
        console.error('Error updating submission status:', submissionError);
      }

      // Update local state
      setApprovals(prev => ({
        ...prev,
        [profile.student_id]: { 
          student_id: profile.student_id, 
          offer_letter_approved: prev[profile.student_id]?.offer_letter_approved || false, 
          credits_awarded: true 
        }
      }));

      Alert.alert('Credits Awarded', `2 credits have been awarded to ${profile.full_name}. Total credits: ${newCredits}`);
      
      // Reload data to ensure consistency
      await loadData();
    } catch (err) {
      console.error('Failed to award credits:', err);
      Alert.alert('Error', 'Failed to award credits.');
    }
  };

  const getAssignmentButtonStyle = (studentId: string, assignment: typeof STATIC_ASSIGNMENTS[0]) => {
    const submission = getStudentSubmission(studentId, assignment.type);
    const hasFile = !!submission?.file_url;
    const isApproved = submission?.submission_status === 'approved';

    if (isApproved) {
      return { ...styles.assignmentButton, backgroundColor: '#34C759' }; // Green for approved
    } else if (hasFile) {
      return { ...styles.assignmentButton, backgroundColor: '#007AFF' }; // Blue for uploaded
    } else {
      return { ...styles.assignmentButton, backgroundColor: '#6B6B6B' }; // Gray for not uploaded
    }
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
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.exportButton} onPress={exportToExcel}>
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.exportButtonText}>Export</Text>
          </TouchableOpacity>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatsText}>{profiles.length} Students</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bulk Download Section */}
        <View style={styles.bulkDownloadSection}>
          <Text style={styles.sectionTitle}>Download Documents by Type</Text>
          <View style={styles.downloadButtonsGrid}>
            {STATIC_ASSIGNMENTS.map((assignment) => (
              <TouchableOpacity
                key={assignment.type}
                style={[styles.downloadTypeButton, downloading === assignment.type && styles.disabledButton]}
                onPress={() => downloadAllDocuments(assignment.type)}
                disabled={downloading === assignment.type}
              >
                <Download size={16} color="#FFFFFF" />
                <Text style={styles.downloadTypeButtonText}>
                  {downloading === assignment.type ? 'Downloading...' : assignment.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.list}>
          {profiles.map((profile) => {
            const approval = approvals[profile.student_id];
            const isApproved = approval?.offer_letter_approved || false;
            const creditsAwarded = approval?.credits_awarded || false;

            return (
              <View key={profile.id} style={styles.studentCard}>
                <View style={styles.studentHeader}>
                  <View>
                    <Text style={styles.studentName}>{profile.full_name}</Text>
                    <Text style={styles.studentMeta}>{profile.uid} • {profile.roll_no}</Text>
                    {isApproved && (
                      <View style={styles.approvedBadge}>
                        <CheckCircle size={14} color="#34C759" />
                        <Text style={styles.approvedText}>Offer Letter Approved</Text>
                      </View>
                    )}
                    {creditsAwarded && (
                      <View style={styles.creditsBadge}>
                        <Award size={14} color="#FF9500" />
                        <Text style={styles.creditsText}>2 Credits Awarded</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Assignment Buttons Row */}
                <View style={styles.assignmentButtonsContainer}>
                  <Text style={styles.assignmentsLabel}>Assignments:</Text>
                  <View style={styles.assignmentButtons}>
                    {STATIC_ASSIGNMENTS.map((assignment) => {
                      const submission = getStudentSubmission(profile.student_id, assignment.type);
                      const hasFile = !!submission?.file_url;
                      
                      return (
                        <TouchableOpacity
                          key={assignment.type}
                          style={getAssignmentButtonStyle(profile.student_id, assignment)}
                          disabled={!hasFile}
                          onPress={() => {
                            if (hasFile) {
                              viewSubmission(profile.student_id, assignment.type, assignment.title);
                            }
                          }}
                        >
                          <FileText size={12} color="#FFFFFF" />
                          <Text style={styles.assignmentButtonText}>
                            {assignment.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      styles.approveButton,
                      isApproved && styles.approvedButton
                    ]}
                    onPress={() => approveOfferLetter(profile.student_id)}
                  >
                    <Text style={styles.actionButtonText}>
                      {isApproved ? 'Approved ✓' : 'Approve Offer Letter'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionButton, 
                      styles.creditsButton,
                      (creditsAwarded || !getStudentSubmission(profile.student_id, 'completion_letter')) && styles.awardedButton
                    ]}
                    onPress={() => awardCredits(profile)}
                    disabled={creditsAwarded || !getStudentSubmission(profile.student_id, 'completion_letter')}
                  >
                    <Award size={16} color="#FFFFFF" />
                    <Text style={styles.actionButtonText}>
                      {creditsAwarded 
                        ? 'Credits Awarded ✓' 
                        : !getStudentSubmission(profile.student_id, 'completion_letter')
                        ? 'Need Completion Letter'
                        : 'Award 2 Credits'
                      }
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 199, 89, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  exportButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  bulkDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(175, 82, 222, 0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  bulkDownloadButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
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
  bulkDownloadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  downloadButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  downloadTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#AF52DE',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    minWidth: '45%',
    justifyContent: 'center',
  },
  downloadTypeButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  list: {
    gap: 16,
    paddingBottom: 40,
  },
  studentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  studentHeader: {
    marginBottom: 16,
  },
  studentName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  studentMeta: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  approvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  approvedText: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
  },
  creditsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creditsText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '600',
  },
  assignmentButtonsContainer: {
    marginBottom: 16,
  },
  assignmentsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  assignmentButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assignmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
    minWidth: 100,
  },
  assignmentButtonText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 6,
  },
  approveButton: {
    backgroundColor: '#007AFF',
  },
  approvedButton: {
    backgroundColor: '#34C759',
  },
  creditsButton: {
    backgroundColor: '#FF9500',
  },
  awardedButton: {
    backgroundColor: '#6B6B6B',
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});