import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { User, Hash, FileText, GraduationCap, Building, Upload, Save, LogOut, Mail } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isSupabaseConfigured, uploadFile, getPublicUrl } from '@/lib/supabase';
import * as DocumentPicker from 'expo-document-picker';
import { RealtimeChannel } from '@supabase/supabase-js';

interface StudentProfile {
  id?: string;
  full_name: string;
  uid: string;
  roll_no: string;
  class: string;
  stream_12th: string;
  resume_url?: string;
  marksheet_10th_url?: string;
  marksheet_12th_url?: string;
}

export default function StudentProfile() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<StudentProfile>({
    full_name: '',
    uid: '',
    roll_no: '',
    class: 'SYIT',
    stream_12th: 'Science',
    resume_url: '',
    marksheet_10th_url: '',
    marksheet_12th_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    loadProfile();
    setupRealtimeSubscription();
    
    return () => {
      if (realtimeChannel) {
        realtimeChannel.unsubscribe();
      }
    };
  }, [user]);

  const setupRealtimeSubscription = () => {
    if (!user?.id) return;

    if (!supabase || !isSupabaseConfigured()) return;

    const channel = supabase!
      .channel('student-profile-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_profiles',
          filter: `student_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Profile updated:', payload);
          if (payload.eventType === 'UPDATE' && payload.new) {
            setProfile(payload.new as StudentProfile);
          }
        }
      )
      .subscribe();

    setRealtimeChannel(channel);
  };

  const loadProfile = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      
      if (!isSupabaseConfigured()) {
        // Use mock data if Supabase is not configured
        setProfile(prev => ({
          ...prev,
          full_name: user.name || '',
          uid: user.uid || '',
          roll_no: user.rollNo || '',
        }));
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase!
        .from('student_profiles')
        .select('*')
        .eq('student_id', user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
      } else if (user) {
        setProfile(prev => ({
          ...prev,
          full_name: user.name || '',
          uid: user.uid || '',
          roll_no: user.rollNo || '',
        }));
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    if (!profile.full_name || !profile.uid || !profile.roll_no) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (!isSupabaseConfigured()) {
        // Mock save for development
        await new Promise(resolve => setTimeout(resolve, 1000));
        Alert.alert('Success', 'Profile saved successfully! (Demo mode)');
        setSaving(false);
        return;
      }

      const profileData = {
        student_id: user.id,
        full_name: profile.full_name,
        uid: profile.uid,
        roll_no: profile.roll_no,
        email: user.email, // Ensure email is included
        class: profile.class,
        stream_12th: profile.stream_12th,
        resume_url: profile.resume_url,
        marksheet_10th_url: profile.marksheet_10th_url,
        marksheet_12th_url: profile.marksheet_12th_url,
        updated_at: new Date().toISOString(),
      };

      // Also update the class in the students table
      const { error: studentUpdateError } = await supabase!
        .from('students')
        .update({ class: profile.class })
        .eq('id', user.id);

      if (studentUpdateError) {
        console.error('Error updating student class:', studentUpdateError);
      }

      const { data: existingProfile } = await supabase!
        .from('student_profiles')
        .select('id')
        .eq('student_id', user.id)
        .maybeSingle();

      let error;
      if (existingProfile) {
        const { error: updateError } = await supabase!
          .from('student_profiles')
          .update(profileData)
          .eq('student_id', user.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase!
          .from('student_profiles')
          .insert(profileData);
        error = insertError;
      }

      if (error) {
        throw new Error(error.message);
      }

      // Reload profile to get the latest data
      await loadProfile();
      Alert.alert('Success', 'Profile saved successfully!');
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('Failed to save profile: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  const uploadDocument = async (type: 'resume' | '10th' | '12th') => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const fileUri = file.uri;
      const fileName = `${user.id}_${type}_${Date.now()}.pdf`;

      const response = await fetch(fileUri);
      const blob = await response.blob();

      const { publicUrl } = await uploadFile('student-documents', fileName, blob, {
        contentType: file.mimeType || 'application/pdf',
      });

      if (publicUrl) {
        const urlKey = type === 'resume' ? 'resume_url' : 
                      type === '10th' ? 'marksheet_10th_url' : 'marksheet_12th_url';
        setProfile((prev) => ({
          ...prev,
          [urlKey]: publicUrl,
        }));
      }
      
      Alert.alert('Success', `${type === 'resume' ? 'Resume' : type + ' marksheet'} uploaded successfully!`);
    } catch (err) {
      console.error('Upload error:', err);
      Alert.alert('Error', `Something went wrong while uploading the ${type === 'resume' ? 'resume' : type + ' marksheet'}.`);
    }
  };

  const classOptions = ['SYIT', 'SYSD', 'TYIT', 'TYSD'];
  const streamOptions = ['Science', 'Commerce', 'Arts'];

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Profile</Text>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <LogOut size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(() => {
                  if (!profile.full_name || profile.full_name.trim() === '') {
                    return 'ST';
                  }
                  const initials = profile.full_name
                    .trim()
                    .split(' ')
                    .filter(name => name.length > 0)
                    .map(name => name[0])
                    .join('')
                    .toUpperCase();
                  return initials.length > 0 ? initials : 'ST';
                })()}
              </Text>
            </View>
            <Text style={styles.welcomeText}>Complete your profile</Text>
          </View>

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.formSection}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <View style={styles.inputWrapper}>
                <User size={20} color="#6B6B6B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your full name"
                  value={profile.full_name}
                  onChangeText={(text) => setProfile(prev => ({ ...prev, full_name: text }))}
                  placeholderTextColor="#6B6B6B"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>College UID *</Text>
              <View style={styles.inputWrapper}>
                <Hash size={20} color="#6B6B6B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your UID"
                  value={profile.uid}
                  onChangeText={(text) => setProfile(prev => ({ ...prev, uid: text }))}
                  placeholderTextColor="#6B6B6B"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Roll Number *</Text>
              <View style={styles.inputWrapper}>
                <FileText size={20} color="#6B6B6B" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your roll number"
                  value={profile.roll_no}
                  onChangeText={(text) => setProfile(prev => ({ ...prev, roll_no: text }))}
                  placeholderTextColor="#6B6B6B"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Class</Text>
              <View style={styles.dropdownContainer}>
                {classOptions.map((classOption) => (
                  <TouchableOpacity
                    key={classOption}
                    style={[
                      styles.dropdownOption,
                      profile.class === classOption && styles.selectedOption
                    ]}
                    onPress={() => setProfile(prev => ({ ...prev, class: classOption }))}
                  >
                    <GraduationCap size={16} color={profile.class === classOption ? "#FFFFFF" : "#6B6B6B"} />
                    <Text style={[
                      styles.dropdownText,
                      profile.class === classOption && styles.selectedText
                    ]}>
                      {classOption}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>12th Standard Stream</Text>
              <View style={styles.dropdownContainer}>
                {streamOptions.map((streamOption) => (
                  <TouchableOpacity
                    key={streamOption}
                    style={[
                      styles.dropdownOption,
                      profile.stream_12th === streamOption && styles.selectedOption
                    ]}
                    onPress={() => setProfile(prev => ({ ...prev, stream_12th: streamOption }))}
                  >
                    <Building size={16} color={profile.stream_12th === streamOption ? "#FFFFFF" : "#6B6B6B"} />
                    <Text style={[
                      styles.dropdownText,
                      profile.stream_12th === streamOption && styles.selectedText
                    ]}>
                      {streamOption}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Resume (PDF)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={() => uploadDocument('resume')}>
                <Upload size={20} color="#007AFF" />
                <Text style={styles.uploadText}>
                  {profile.resume_url ? 'Update Resume' : 'Upload Resume'}
                </Text>
              </TouchableOpacity>
              {profile.resume_url && (
                <Text style={styles.uploadedText}>✓ Resume uploaded</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>10th Grade Marksheet (PDF)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={() => uploadDocument('10th')}>
                <Upload size={20} color="#007AFF" />
                <Text style={styles.uploadText}>
                  {profile.marksheet_10th_url ? 'Update 10th Marksheet' : 'Upload 10th Marksheet'}
                </Text>
              </TouchableOpacity>
              {profile.marksheet_10th_url && (
                <Text style={styles.uploadedText}>✓ 10th marksheet uploaded</Text>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>12th Grade Marksheet (PDF)</Text>
              <TouchableOpacity style={styles.uploadButton} onPress={() => uploadDocument('12th')}>
                <Upload size={20} color="#007AFF" />
                <Text style={styles.uploadText}>
                  {profile.marksheet_12th_url ? 'Update 12th Marksheet' : 'Upload 12th Marksheet'}
                </Text>
              </TouchableOpacity>
              {profile.marksheet_12th_url && (
                <Text style={styles.uploadedText}>✓ 12th marksheet uploaded</Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={saveProfile}
            disabled={saving}
          >
            <Save size={20} color="#FFFFFF" style={styles.saveIcon} />
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
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
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  welcomeText: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#D32F2F',
    textAlign: 'center',
  },
  formSection: {
    gap: 24,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
  },
  dropdownContainer: {
    gap: 12,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  selectedOption: {
    backgroundColor: '#007AFF',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1C1C1E',
  },
  selectedText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  uploadText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  uploadedText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 32,
    marginBottom: 40,
    gap: 8,
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  saveIcon: {
    marginRight: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});