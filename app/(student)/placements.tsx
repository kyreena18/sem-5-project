import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { Briefcase, Calendar, Building, Users, FileText, Upload, X, CircleCheck as CheckCircle, TriangleAlert as AlertTriangle, Bell } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, uploadFile, getPublicUrl } from '@/lib/supabase';
import { formatDate, getStatusColor, getRequirementLabel } from '@/lib/utils';
import * as DocumentPicker from 'expo-document-picker';

// Create a cross-platform Linking object
const Linking = {
  openURL: (url: string) => {
    if (Platform.OS === 'web') {
      return WebBrowser.openBrowserAsync(url);
    } else {
      return ExpoLinking.openURL(url);
    }
  }
};

interface PlacementEvent {
  id: string;
  title: string;
  description: string;
  company_name: string;
  event_date: string;
  application_deadline: string;
  requirements: string;
  eligible_classes: string[];
  additional_requirements: { type: string; required: boolean }[];
  bucket_name: string;
  is_active: boolean;
  created_at: string;
}

interface PlacementApplication {
  id: string;
  placement_event_id: string;
  application_status: 'pending' | 'applied' | 'accepted' | 'rejected';
  applied_at: string;
  admin_notes?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'placement' | 'internship' | 'general';
  created_at: string;
  read_by: string[];
}

export default function PlacementsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PlacementEvent[]>([]);
  const [applications, setApplications] = useState<PlacementApplication[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [studentClass, setStudentClass] = useState<string>('');
  const [showRequirementsModal, setShowRequirementsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlacementEvent | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submittedRequirements, setSubmittedRequirements] = useState<{[key: string]: boolean}>({});
  const [requirementUrls, setRequirementUrls] = useState<{ [key: string]: string }>({});
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const uploadOfferLetter = async (eventId: string, applicationId: string) => {
    if (!user?.id) return;

    try {
      setUploading(`offer_${applicationId}`);

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setUploading(null);
        return;
      }

      const file = result.assets[0];
      const fileExtension = file.name.split('.').pop() || 'pdf';
      const fileName = `${user.id}_offer_letter_${Date.now()}.${fileExtension}`;

      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock upload for development
        Alert.alert('Demo Mode', 'Offer letter would be uploaded (Demo mode)');
        setUploading(null);
        return;
      }

      // Upload to placement-offers bucket
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { publicUrl } = await uploadFile('placement-offer-letters', fileName, blob, {
        contentType: file.mimeType || 'application/pdf',
      });

      // Update application with offer letter URL
      const { error } = await supabase
        .from('placement_applications')
        .update({ offer_letter_url: publicUrl })
        .eq('id', applicationId);

      if (error) {
        console.error('Database update error:', error);
        Alert.alert('Error', 'Failed to save offer letter URL.');
        setUploading(null);
        return;
      }

      Alert.alert('Success', 'Offer letter uploaded successfully!');
      loadMyApplications(); // Refresh applications to show updated status
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload offer letter. Please try again.');
    } finally {
      setUploading(null);
    }
  };

  useEffect(() => {
    const initializeData = async () => {
      await loadStudentClass();
    };
    initializeData();
  }, [user]);

  useEffect(() => {
    if (studentClass) {
      loadPlacementEvents();
      loadMyApplications();
      loadNotifications();
      setupRealtimeSubscriptions();
    }
  }, [studentClass]);

  // Reload submitted requirements whenever the student's applications change
  useEffect(() => {
    if (!user?.id) return;
    loadSubmittedRequirements();
  }, [applications, user?.id]);

  const loadStudentClass = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('student_profiles')
        .select('class')
        .eq('student_id', user.id)
        .single();

      if (data?.class) {
        setStudentClass(data.class);
      } else {
        // Default to TYIT for demo if no class found
        setStudentClass('TYIT');
      }
    } catch (error) {
      console.error('Error loading student class:', error);
      setStudentClass('TYIT');
    }
  };

  const loadNotifications = async () => {
    try {
      // Check if Supabase is configured
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl || supabaseUrl.includes('your-project-id')) {
        // Mock data for development
        setNotifications([]);
        setUnreadNotifications(0);
        return;
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .or(`type.eq.placement,type.eq.general`)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Error loading notifications:', error);
        setNotifications([]);
        setUnreadNotifications(0);
        return;
      }
      
      const notificationData = data || [];
      setNotifications(notificationData);
      
      // Count unread notifications
      const unread = notificationData.filter(notification => 
        !notification.read_by.includes(user?.id || '')
      ).length;
      setUnreadNotifications(unread);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const setupRealtimeSubscriptions = () => {
    if (!user?.id) return;

    // Subscribe to notifications
    const notificationsChannel = supabase
      .channel('placement-notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    // Subscribe to placement events
    const eventsChannel = supabase
      .channel('placement-events-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'placement_events',
        },
        () => {
          loadPlacementEvents();
        }
      )
      .subscribe();

    return () => {
      notificationsChannel.unsubscribe();
      eventsChannel.unsubscribe();
    };
  };

  const loadPlacementEvents = async () => {
    try {
      const { data: eventsData, error } = await supabase
        .from('placement_events')
        .select(`
          *,
          placement_requirements (
            id,
            type,
            description,
            is_required
          )
        `)
        .eq('is_active', true)
        .order('event_date', { ascending: true });

      if (error) throw error;

      // Filter events based on student's class
      const filteredEvents = (eventsData || []).filter(event => {
        // If no eligible_classes specified, show to all students
        if (!event.eligible_classes || event.eligible_classes.length === 0) {
          return true;
        }
        // Check if student's class is in eligible classes
        return event.eligible_classes.includes(studentClass);
      }).map(event => ({
        ...event,
        additional_requirements: event.placement_requirements?.map((req: any) => ({
          type: req.type,
          required: req.is_required
        })) || []
      }));

      setEvents(filteredEvents);
    } catch (error) {
      console.error('Error loading placement events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSubmittedRequirements = async () => {
    if (!user?.id) return;

    try {
      // Collect this student's application IDs to fetch their submissions
      const applicationIds = applications.map(app => app.id);

      if (applicationIds.length === 0) {
        setSubmittedRequirements({});
        return;
      }

      const { data, error } = await supabase
        .from('student_requirement_submissions')
        .select(`
          file_url,
          placement_application_id,
          requirement_id,
          placement_requirements (
            type,
            event_id
          )
        `)
        .in('placement_application_id', applicationIds);

      if (error) throw error;

      const submitted: { [key: string]: boolean } = {};
      const urls: { [key: string]: string } = {};
      (data || []).forEach((submission: any) => {
        const rel = submission.placement_requirements;
        if (rel?.event_id && rel?.type) {
          const key = `${rel.event_id}_${rel.type}`;
          submitted[key] = true;
          if (submission.file_url) {
            urls[key] = submission.file_url;
          }
        }
      });

      setSubmittedRequirements(submitted);
      setRequirementUrls(urls);
    } catch (error) {
      console.error('Error loading submitted requirements:', error);
    }
  };

  const loadMyApplications = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('placement_applications')
        .select('*')
        .eq('student_id', user.id);

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
      setApplications([]);
    }
  };

  const applyForPlacement = async (eventId: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'Please log in to apply.');
      return;
    }

    if (hasAcceptedOffer) {
      Alert.alert('Not Eligible', 'You have already been accepted for a placement. You are not eligible to apply for further events.');
      return;
    }

    try {
      setApplying(eventId);

      const { error } = await supabase
        .from('placement_applications')
        .insert({
          placement_event_id: eventId,
          student_id: user.id,
          application_status: 'applied',
        });

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Applied', 'You have already applied for this placement.');
          return;
        }
        throw error;
      }

      Alert.alert('Success', 'Application submitted successfully!');
      loadMyApplications();
    } catch (error) {
      console.error('Application error:', error);
      Alert.alert('Error', 'Failed to submit application.');
    } finally {
      setApplying(null);
    }
  };

  const getApplicationStatus = (eventId: string) => {
    return applications.find(app => app.placement_event_id === eventId);
  };
  const hasAcceptedOffer = applications.some(app => app.application_status === 'accepted');
  const uploadRequirement = async (eventId: string, requirementType: string, bucketName: string) => {
    if (!user?.id) return;

    try {
      setUploading(requirementType);

      // Use expo-document-picker to select file
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*', 'video/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setUploading(null);
        return;
      }

      const file = result.assets[0];
      const fileExtension = file.name.split('.').pop() || 'pdf';
      const fileName = `${user.id}_${requirementType}_${Date.now()}.${fileExtension}`;

      // Upload file to Supabase storage
      const response = await fetch(file.uri);
      const blob = await response.blob();

      const { publicUrl } = await uploadFile('placement-offer-letters', fileName, blob, {
        contentType: file.mimeType || 'application/pdf',
      });

      // Get the application for this event
      const application = applications.find(app => app.placement_event_id === eventId);
      if (!application) {
        Alert.alert('Error', 'Please apply for this placement first before uploading requirements.');
        return;
      }

      // Get the placement requirement record
      const { data: requirementData, error: reqError } = await supabase
        .from('placement_requirements')
        .select('id')
        .eq('event_id', eventId)
        .eq('type', requirementType)
        .single();

      if (reqError || !requirementData) {
        throw new Error('Requirement not found');
      }

      // Store the student's requirement submission
      const { error } = await supabase
        .from('student_requirement_submissions')
        .upsert({
          placement_application_id: application.id,
          requirement_id: requirementData.id,
          file_url: publicUrl,
          submission_status: 'pending',
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'placement_application_id,requirement_id' });

      if (error) throw error;

      Alert.alert('Success', `${getRequirementLabel(requirementType)} uploaded successfully!`);
      
      // Update local state to reflect the upload
      const key = `${eventId}_${requirementType}`;
      setSubmittedRequirements(prev => ({ ...prev, [key]: true }));
      if (publicUrl) {
        setRequirementUrls(prev => ({ ...prev, [key]: publicUrl }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', `Failed to upload ${getRequirementLabel(requirementType)}. Please try again.`);
    } finally {
      setUploading(null);
    }
  };

  const viewRequirements = (event: PlacementEvent) => {
    setSelectedEvent(event);
    loadSubmittedRequirements();
    setShowRequirementsModal(true);
  };

  const isDeadlinePassed = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  if (loading) {
    return (
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading placements...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Placement Opportunities</Text>
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
            <Text style={styles.headerStatsText}>{events.length} Available</Text>
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        {notifications.length > 0 && (
          <View style={styles.notificationsSection}>
            <Text style={styles.sectionTitle}>Recent Notifications</Text>
            <View style={styles.notificationsList}>
              {notifications.slice(0, 3).map((notification) => (
                <View key={notification.id} style={styles.notificationCard}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationMessage}>{notification.message}</Text>
                  <Text style={styles.notificationDate}>
                    {formatDate(notification.created_at)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {events.length === 0 ? (
          <View style={styles.emptyState}>
            <Briefcase size={64} color="#6B6B6B" />
            <Text style={styles.emptyStateTitle}>No Placements Available</Text>
            <Text style={styles.emptyStateText}>
              No placements available for your class ({studentClass})
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => {
              const application = getApplicationStatus(event.id);
              const deadlinePassed = isDeadlinePassed(event.application_deadline);

              return (
                <View key={event.id} style={styles.eventCard}>
                  <View style={styles.eventHeader}>
                    <View style={styles.companyInfo}>
                      <Building size={32} color="#007AFF" />
                      <View style={styles.companyDetails}>
                        <Text style={styles.companyName}>{event.company_name}</Text>
                        <Text style={styles.eventTitle}>{event.title}</Text>
                      </View>
                    </View>
                    {application && (
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(application.application_status) }]}>
                        <Text style={styles.statusText}>
                          {application.application_status.toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.eventDescription}>{event.description}</Text>

                  <View style={styles.eventDetails}>
                    <View style={styles.detailItem}>
                      <Calendar size={16} color="#6B6B6B" />
                      <Text style={styles.detailText}>
                        Event: {formatDate(event.event_date)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Calendar size={16} color="#6B6B6B" />
                      <Text style={styles.detailText}>
                        Deadline: {formatDate(event.application_deadline)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.requirementsSection}>
                    <Text style={styles.requirementsTitle}>Requirements:</Text>
                    <Text style={styles.requirementsText}>{event.requirements}</Text>
                  </View>

                  {event.additional_requirements && event.additional_requirements.length > 0 && (
                    <TouchableOpacity
                      style={styles.viewRequirementsButton}
                      onPress={() => viewRequirements(event)}
                    >
                      <FileText size={16} color="#007AFF" />
                      <Text style={styles.viewRequirementsText}>
                        View Additional Requirements ({event.additional_requirements.length})
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Offer Letter Upload for Accepted Students */}
                  {application && application.application_status === 'accepted' && (
                    <View style={styles.offerLetterSection}>
                      <Text style={styles.offerLetterTitle}>🎉 Congratulations! You've been accepted!</Text>
                      {application.offer_letter_url ? (
                        <View style={styles.offerLetterUploaded}>
                          <Text style={styles.offerLetterUploadedText}>✅ Offer letter uploaded successfully</Text>
                          <TouchableOpacity
                            style={styles.reuploadOfferButton}
                            onPress={() => uploadOfferLetter(event.id, application.id)}
                            disabled={uploading === `offer_${application.id}`}
                          >
                            <Upload size={16} color="#007AFF" />
                            <Text style={styles.reuploadOfferText}>
                              {uploading === `offer_${application.id}` ? 'Updating...' : 'Update Offer Letter'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[styles.uploadOfferButton, uploading === `offer_${application.id}` && styles.disabledButton]}
                          onPress={() => uploadOfferLetter(event.id, application.id)}
                          disabled={uploading === `offer_${application.id}`}
                        >
                          <Upload size={20} color="#FFFFFF" />
                          <Text style={styles.uploadOfferButtonText}>
                            {uploading === `offer_${application.id}` ? 'Uploading...' : 'Upload Offer Letter'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  {application ? (
                    <View style={styles.appliedSection}>
                      <Text style={styles.appliedText}>
                        Applied on {formatDate(application.applied_at)}
                      </Text>
                      {application.admin_notes && (
                        <Text style={styles.adminNotes}>
                          Notes: {application.admin_notes}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.applyButton,
                        (deadlinePassed || applying === event.id || hasAcceptedOffer) && styles.disabledButton,
                      ]}
                      onPress={() => applyForPlacement(event.id)}
                      disabled={deadlinePassed || applying === event.id || hasAcceptedOffer}
                    >
                      <Users size={20} color="#FFFFFF" />
                      <Text style={styles.applyButtonText}>
                        {applying === event.id
                          ? 'Applying...'
                          : deadlinePassed
                          ? 'Deadline Passed'
                          : hasAcceptedOffer
                          ? 'Not Eligible (Accepted)'
                          : 'Apply Now'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );

            })}
          </View>
        )}
      </ScrollView>

      {/* Additional Requirements Modal */}
      <Modal
        visible={showRequirementsModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Additional Requirements</Text>
            <TouchableOpacity onPress={() => setShowRequirementsModal(false)}>
              <X size={24} color="#1C1C1E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {selectedEvent?.additional_requirements?.map((requirement) => (
              <View key={requirement.type} style={styles.requirementCard}>
                <View style={styles.requirementHeader}>
                  <Text style={styles.requirementTitle}>
                    {getRequirementLabel(requirement.type)}
                    {requirement.required && <Text style={styles.requiredAsterisk}> *</Text>}
                  </Text>
                  {requirement.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>Required</Text>
                    </View>
                  )}
                </View>

                {submittedRequirements[`${selectedEvent.id}_${requirement.type}`] ? (
                  <View style={styles.submittedSection}>
                    <View style={styles.submittedIndicator}>
                      <CheckCircle size={16} color="#34C759" />
                      <Text style={styles.submittedText}>Submitted</Text>
                    </View>
                    {requirementUrls[`${selectedEvent.id}_${requirement.type}`] && (
                      <TouchableOpacity
                        style={styles.reuploadButton}
                        onPress={() => Linking.openURL(requirementUrls[`${selectedEvent.id}_${requirement.type}`])}
                      >
                        <FileText size={16} color="#007AFF" />
                        <Text style={styles.reuploadText}>View</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.reuploadButton, uploading === requirement.type && styles.disabledButton]}
                      onPress={() => uploadRequirement(selectedEvent.id, requirement.type, selectedEvent.bucket_name)}
                      disabled={uploading === requirement.type}
                    >
                      <Upload size={16} color="#007AFF" />
                      <Text style={styles.reuploadText}>
                        {uploading === requirement.type ? 'Uploading...' : 'Update'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.uploadButton, uploading === requirement.type && styles.disabledButton]}
                    onPress={() => uploadRequirement(selectedEvent.id, requirement.type, selectedEvent.bucket_name)}
                    disabled={uploading === requirement.type}
                  >
                    <Upload size={16} color="#FFFFFF" />
                    <Text style={styles.uploadButtonText}>
                      {uploading === requirement.type ? 'Uploading...' : `Upload ${getRequirementLabel(requirement.type)}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}

            {(!selectedEvent?.additional_requirements || selectedEvent.additional_requirements.length === 0) && (
              <View style={styles.noRequirements}>
                <FileText size={48} color="#6B6B6B" />
                <Text style={styles.noRequirementsText}>No additional requirements for this placement</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
  notificationsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  notificationsList: {
    gap: 16,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: '#6B6B6B',
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
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  eventsList: {
    gap: 24,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  companyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companyDetails: {
    marginLeft: 12,
    flex: 1,
  },
  companyName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    color: '#6B6B6B',
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
  eventDescription: {
    fontSize: 14,
    color: '#1C1C1E',
    lineHeight: 20,
    marginBottom: 16,
  },
  eventDetails: {
    gap: 8,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#6B6B6B',
  },
  requirementsSection: {
    marginBottom: 16,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  requirementsText: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
  },
  appliedSection: {
    backgroundColor: '#F2F2F7',
    borderRadius: 16,
    padding: 16,
  },
  appliedText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
    marginBottom: 8,
  },
  adminNotes: {
    fontSize: 14,
    color: '#6B6B6B',
    fontStyle: 'italic',
    marginBottom: 12,
  },
  offerLetterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 12,
    gap: 8,
  },
  offerLetterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applyButton: {
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
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  viewRequirementsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 20,
  },
  viewRequirementsText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  requirementCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  requirementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requirementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  requiredAsterisk: {
    color: '#FF3B30',
  },
  requiredBadge: {
    backgroundColor: '#FF3B30',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  requiredText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  noRequirements: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  noRequirementsText: {
    fontSize: 16,
    color: '#6B6B6B',
    marginTop: 16,
    textAlign: 'center',
  },
  submittedSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  submittedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submittedText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  reuploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  reuploadText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  offerLetterSection: {
    backgroundColor: '#E8F5E8',
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  offerLetterTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#34C759',
    marginBottom: 12,
    textAlign: 'center',
  },
  offerLetterUploaded: {
    alignItems: 'center',
    gap: 12,
  },
  offerLetterUploadedText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  reuploadOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  reuploadOfferText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  uploadOfferButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 8,
  },
  uploadOfferButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});