import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GraduationCap, Upload, FileText, Bell, Lock } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, uploadFile, getPublicUrl } from '@/lib/supabase';
import { STATIC_ASSIGNMENTS } from '@/lib/constants';
import { formatDate, getStatusColor } from '@/lib/utils';
import * as DocumentPicker from 'expo-document-picker';

interface StudentSubmission {
  id: string;
  student_id: string;
  assignment_type: string;
  file_url: string;
  submission_status: 'submitted' | 'approved' | 'rejected';
  submitted_at: string;
  admin_feedback?: string;
}

interface StudentApproval {
  student_id: string;
  offer_letter_approved: boolean;
  credits_awarded: boolean;
}

export default function StudentInternshipsScreen() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [approval, setApproval] = useState<StudentApproval>({ offer_letter_approved: false, credits_awarded: false });
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (user?.id) {
      loadSubmissions();
      loadApprovalStatus();
    }
  }, [user]);

  const loadSubmissions = async () => {
    if (!user?.id) return;

    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock data for development
        setSubmissions([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('student_internship_submissions')
        .select('*')
        .eq('student_id', user.id);

      if (error) {
        console.error('Error loading submissions:', error);
        setSubmissions([]);
      } else {
        setSubmissions(data || []);
      }
    } catch (error) {
      console.error('Error loading submissions:', error);
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadApprovalStatus = async () => {
    if (!user?.id) return;

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        setApproval({ offer_letter_approved: false, credits_awarded: false });
        return;
      }

      // First check if student has an offer letter submission
      const { data: offerLetterSub } = await supabase
        .from('student_internship_submissions')
        .select('id')
        .eq('student_id', user.id)
        .eq('assignment_type', 'offer_letter')
        .maybeSingle();

      // If no offer letter, reset approval status
      if (!offerLetterSub) {
        await supabase
          .from('student_internship_approvals')
          .update({ offer_letter_approved: false })
          .eq('student_id', user.id);
        
        setApproval({ offer_letter_approved: false, credits_awarded: false });
        return;
      }

      const { data, error } = await supabase
        .from('student_internship_approvals')
        .select('offer_letter_approved, credits_awarded')
        .eq('student_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading approval status:', error);
        setApproval({ offer_letter_approved: false, credits_awarded: false });
      } else {
        setApproval(data || { offer_letter_approved: false, credits_awarded: false });
      }
    } catch (error) {
      console.error('Error loading approval status:', error);
      setApproval({ offer_letter_approved: false, credits_awarded: false });
    }
  };

  const uploadDocument = async (assignmentType: string, bucketName: string, title: string) => {
    if (!user?.id) return;

    console.log(`Attempting to upload ${title} to bucket: ${bucketName} (using student-documents for now)`);

    try {
      setUploading(assignmentType);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setUploading(null);
        return;
      }

      const file = result.assets[0];
      const fileExtension = file.name.split('.').pop() || 'pdf';
      const fileName = `${user.id}_${assignmentType}_${Date.now()}.${fileExtension}`;

      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock upload for development
        console.log('Demo mode - would upload to bucket: student-documents');
        Alert.alert('Demo Mode', `${title} would be uploaded to student-documents (Demo mode)`);
        
        const mockSubmission: StudentSubmission = {
          id: `mock-${assignmentType}`,
          student_id: user.id,
          assignment_type: assignmentType,
          file_url: `https://example.com/mock-${assignmentType}.pdf`,
          submission_status: 'submitted',
          submitted_at: new Date().toISOString(),
        };
        
        setSubmissions(prev => {
          const filtered = prev.filter(s => s.assignment_type !== assignmentType);
          return [...filtered, mockSubmission];
        });
        
        setUploading(null);
        return;
      }

      const actualBucket = bucketName;
      console.log('Attempting upload to bucket:', actualBucket);
      console.log('File details:', { name: file.name, size: file.size, type: file.mimeType });

      // Convert file to blob for upload
      const response = await fetch(file.uri);
      const blob = await response.blob();

      console.log('Blob created, size:', blob.size);

      // Upload to Supabase storage using helper function
      const { publicUrl } = await uploadFile('student-documents', fileName, blob, {
        contentType: file.mimeType || 'application/pdf',
      });

      console.log(`Successfully uploaded to bucket: ${actualBucket}`);

      console.log('File URL:', publicUrl);

      if (!publicUrl) {
        Alert.alert('Error', 'Failed to get file URL after upload');
        setUploading(null);
        return;
      }

      // Save submission record to database
      const { error } = await supabase
        .from('student_internship_submissions')
        .upsert({
          student_id: user.id,
          assignment_type: assignmentType,
          file_url: publicUrl,
          submission_status: 'submitted',
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'student_id,assignment_type' });

      if (error) {
        console.error('Database save error:', error);
        Alert.alert('Database Error', `File uploaded but failed to save record: ${error.message}`);
        throw error;
      }

      console.log('Upload successful:', { title, publicUrl });
      Alert.alert('Success', `${title} uploaded successfully!`);
      loadSubmissions();
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', `Failed to upload ${title}. Please try again.`);
    } finally {
      setUploading(null);
    }
  };

  const getSubmissionForAssignment = (assignmentType: string) => {
    return submissions.find(sub => sub.assignment_type === assignmentType);
  };

  const isAssignmentLocked = (assignment: typeof STATIC_ASSIGNMENTS[0]) => {
    if (assignment.type === 'offer_letter') return false;
    return !approval.offer_letter_approved;
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading internship assignments...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Internship Assignments</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationButton}>
            <Bell size={20} color="#FFFFFF" />
            {unreadNotifications > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadNotifications}</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.headerStats}>
            <Text style={styles.headerStatsText}>{STATIC_ASSIGNMENTS.length} Assignments</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.assignmentsList}>
          <Text style={styles.sectionTitle}>Required Assignments</Text>
          
          {approval.offer_letter_approved && (
            <View style={styles.approvalBanner}>
              <Text style={styles.approvalText}>✅ Offer Letter Approved - All assignments unlocked!</Text>
            </View>
          )}

          {STATIC_ASSIGNMENTS.map((assignment) => {
            const submission = getSubmissionForAssignment(assignment.type);
            const isLocked = isAssignmentLocked(assignment);

            return (
              <View key={assignment.type} style={styles.assignmentCard}>
                <View style={styles.assignmentHeader}>
                  <View style={styles.assignmentInfo}>
                    <Text style={styles.assignmentTitle}>
                      {assignment.title}
                      {assignment.required && <Text style={styles.requiredAsterisk}> *</Text>}
                    </Text>
                    {isLocked && (
                      <View style={styles.lockedBadge}>
                        <Lock size={12} color="#FF9500" />
                        <Text style={styles.lockedText}>Locked until offer letter approved</Text>
                      </View>
                    )}
                  </View>
                  {submission && (
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(submission.submission_status) }]}>
                      <Text style={styles.statusText}>
                        {submission.submission_status.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.assignmentDescription}>{assignment.description}</Text>

                {submission ? (
                  <View style={styles.submittedSection}>
                    <Text style={styles.submittedText}>
                      Submitted on {formatDate(submission.submitted_at)}
                    </Text>
                    {submission.admin_feedback && (
                      <Text style={styles.adminFeedback}>
                        Feedback: {submission.admin_feedback}
                      </Text>
                    )}
                    <TouchableOpacity
                      style={[styles.uploadButton, uploading === assignment.type && styles.disabledButton]}
                      onPress={() => uploadDocument(assignment.type, assignment.bucket, assignment.title)}
                      disabled={uploading === assignment.type || isLocked}
                    >
                      <Upload size={16} color="#FFFFFF" />
                      <Text style={styles.uploadButtonText}>
                        {uploading === assignment.type ? 'Uploading...' : 'Update Document'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[
                      styles.uploadButton,
                      (uploading === assignment.type || isLocked) && styles.disabledButton
                    ]}
                    onPress={() => uploadDocument(assignment.type, assignment.bucket, assignment.title)}
                    disabled={uploading === assignment.type || isLocked}
                  >
                    <Upload size={16} color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>
                      {uploading === assignment.type
                        ? 'Uploading...'
                        : isLocked
                        ? 'Locked'
                        : `Upload ${assignment.title}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {!approval.offer_letter_approved && (
          <View style={styles.infoCard}>
            <FileText size={24} color="#FF9500" />
            <Text style={styles.infoTitle}>Upload Your Offer Letter First</Text>
            <Text style={styles.infoText}>
              Please upload your internship offer letter and wait for admin approval before you can submit other documents.
            </Text>
          </View>
        )}

        {approval.credits_awarded && (
          <View style={styles.creditsCard}>
            <GraduationCap size={24} color="#34C759" />
            <Text style={styles.creditsTitle}>Credits Awarded!</Text>
            <Text style={styles.creditsText}>
              You have been awarded 2 credits for completing your internship requirements.
            </Text>
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: 'bold',
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
  assignmentsList: {
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  approvalBanner: {
    backgroundColor: '#34C759',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  approvalText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
  assignmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  assignmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  requiredAsterisk: {
    color: '#FF3B30',
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assignmentDescription: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
    marginBottom: 24,
  },
  submittedSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  submittedText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 8,
  },
  adminFeedback: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 20,
  },
  creditsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  creditsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#34C759',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  creditsText: {
    fontSize: 14,
    color: '#34C759',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
  },
});