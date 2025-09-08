import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, Briefcase, Eye, X, User, Download, FileText } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDate, getStatusColor } from '@/lib/utils';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import * as JSZip from 'jszip';

interface PlacementEvent {
  id: string;
  title: string;
  description: string;
  company_name: string;
  requirements: string;
  eligible_classes: string[];
  additional_requirements?: { type: string; required: boolean }[];
  bucket_name?: string;
  event_date?: string;
  application_deadline?: string;
  is_active: boolean;
  created_at: string;
}

interface PlacementApplication {
  id: string;
  placement_event_id: string;
  student_id: string;
  application_status: 'pending' | 'applied' | 'accepted' | 'rejected';
  applied_at: string;
  admin_notes?: string;
  student_requirement_submissions?: {
    id: string;
    requirement_id: string;
    file_url: string;
    submission_status: string;
    placement_requirements: {
      type: string;
      description: string;
    };
  }[];
  students: {
    name: string;
    email: string;
    uid: string;
    roll_no: string;
    student_profiles: {
      full_name: string;
      class: string;
      resume_url?: string;
    } | null;
  };
}

export default function AdminPlacementsScreen() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PlacementEvent[]>([]);
  const [applications, setApplications] = useState<PlacementApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showApplicationsModal, setShowApplicationsModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PlacementEvent | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    company_name: '',
    requirements: '',
    eligible_classes: [] as string[],
    additional_requirements: [] as { type: string; required: boolean }[],
  });

  useEffect(() => {
    loadPlacementEvents();
  }, []);

  const loadPlacementEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('placement_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error loading placement events:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEventApplications = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('placement_applications')
        .select(`
          *,
          students!inner (
            name, 
            email, 
            uid, 
            roll_no,
            student_profiles (
              full_name,
              class,
              resume_url
            )
          ),
          student_requirement_submissions (
            id,
            requirement_id,
            file_url,
            submission_status,
            placement_requirements (
              type,
              description
            )
          )
        `)
        .eq('placement_event_id', eventId)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
      // Mock data for development
      const mockApplications: PlacementApplication[] = [
        {
          id: '1',
          placement_event_id: eventId,
          student_id: '1',
          application_status: 'applied',
          applied_at: new Date().toISOString(),
          admin_notes: '',
          students: {
            name: 'John Doe',
            email: 'john@college.edu',
            uid: 'TYIT001',
            roll_no: 'TYIT001',
            student_profiles: {
              full_name: 'John Doe',
              class: 'TYIT',
              resume_url: 'https://example.com/resume1.pdf'
            }
          }
        }
      ];
      setApplications(mockApplications);
    }
  };

  const downloadPlacementDocuments = async (event: PlacementEvent) => {
    try {
      // Load applications for this event if not already loaded
      if (!applications.length || applications[0]?.placement_event_id !== event.id) {
        await loadEventApplications(event.id);
      }

      // Filter accepted applications with offer letters
      const acceptedWithOfferLetters = applications.filter(app => 
        app.application_status === 'accepted' && app.offer_letter_url
      );

      if (acceptedWithOfferLetters.length === 0) {
        Alert.alert('No Documents', 'No offer letters found for accepted students.');
        return;
      }

      const zip = new JSZip.default();
      let downloadCount = 0;

      // Download each offer letter and add to zip
      for (const application of acceptedWithOfferLetters) {
        try {
          const response = await fetch(application.offer_letter_url!);
          if (response.ok) {
            const blob = await response.blob();
            const fileExtension = application.offer_letter_url!.split('.').pop() || 'pdf';
            const fileName = `${application.students.roll_no}_${application.students.student_profiles?.full_name?.replace(/[^a-zA-Z0-9]/g, '_') || 'Unknown'}.${fileExtension}`;
            zip.file(fileName, blob);
            downloadCount++;
          }
        } catch (error) {
          console.error(`Failed to download offer letter for ${application.students.name}:`, error);
        }
      }

      if (downloadCount === 0) {
        Alert.alert('Download Failed', 'Could not download any offer letters.');
        return;
      }

      // Generate and download zip file
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const timestamp = new Date().toISOString().split('T')[0];
      const zipFileName = `${event.company_name.replace(/[^a-zA-Z0-9]/g, '_')}_Offer_Letters_${timestamp}.zip`;
      
      FileSaver.saveAs(zipBlob, zipFileName);
      
      Alert.alert('Success', `Downloaded ${downloadCount} offer letters in ${zipFileName}`);
    } catch (error) {
      console.error('Bulk download error:', error);
      Alert.alert('Error', 'Failed to download offer letters.');
    }
  };

  const createPlacementEvent = async () => {
    if (!newEvent.title || !newEvent.company_name) {
      Alert.alert('Error', 'Please fill in title and company name');
      return;
    }

    try {
      setCreating(true);

      // Create storage bucket for the company
      const bucketName = `${newEvent.company_name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
      
      const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        allowedMimeTypes: ['application/pdf', 'video/*', 'image/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
        fileSizeLimit: 52428800, // 50MB
      });

      if (bucketError) {
        console.warn('Bucket creation warning:', bucketError);
        // Continue even if bucket creation fails
      }

      const { data: eventData, error } = await supabase
        .from('placement_events')
        .insert({
          title: newEvent.title,
          description: newEvent.description,
          company_name: newEvent.company_name,
          requirements: newEvent.requirements,
          eligible_classes: newEvent.eligible_classes,
          additional_requirements: newEvent.additional_requirements,
          bucket_name: bucketName,
          event_date: new Date().toISOString(),
          application_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      // Create placement requirements for each additional requirement
      if (newEvent.additional_requirements.length > 0 && eventData) {
        const requirementInserts = newEvent.additional_requirements.map(req => ({
          event_id: eventData.id,
          type: req.type,
          description: `${req.type.replace('_', ' ')} submission`,
          is_required: req.required,
        }));

        const { error: reqError } = await supabase
          .from('placement_requirements')
          .insert(requirementInserts);

        if (reqError) {
          console.warn('Requirements creation warning:', reqError);
        }
      }

      Alert.alert('Success', 'Placement event created successfully!');
      setShowCreateModal(false);
      resetForm();
      
      // Create notification for students
      await supabase
        .from('notifications')
        .insert({
          title: 'New Placement Opportunity',
          message: `A new placement opportunity at ${newEvent.company_name} for "${newEvent.title}" has been posted. Apply now!`,
          type: 'placement',
          target_audience: newEvent.eligible_classes.length > 0 ? 'specific_class' : 'all',
          target_classes: newEvent.eligible_classes,
          created_by: user?.id,
          cacheControl: '3600',
          metadata: {
            'Content-Disposition': 'inline'
          }
        });
      
      loadPlacementEvents();
    } catch (error) {
      Alert.alert('Error', 'Failed to create placement event');
    } finally {
      setCreating(false);
    }
  };

  
  const resetForm = () => {
    setNewEvent({
      title: '',
      description: '',
      company_name: '',
      requirements: '',
      eligible_classes: [],
      additional_requirements: [],
    });
  };

  const viewApplications = async (event: PlacementEvent) => {
    setSelectedEvent(event);
    await loadEventApplications(event.id);
    setShowApplicationsModal(true);
  };

  const acceptApplication = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('placement_applications')
        .update({ application_status: 'accepted' })
        .eq('id', applicationId);

      if (error) throw error;

      Alert.alert('Success', 'Application marked as accepted');
      if (selectedEvent?.id) {
        await loadEventApplications(selectedEvent.id);
        
        // Create notification for the student
        const application = applications.find(app => app.id === applicationId);
        if (application) {
          await supabase
            .from('notifications')
            .insert({
              title: `Application ${status.charAt(0).toUpperCase() + status.slice(1)}`,
              message: `Your application for ${selectedEvent.title} at ${selectedEvent.company_name} has been ${status}.`,
              type: 'placement',
              target_audience: 'all', // Will be filtered by student
              created_by: user?.id,
              is_active: true,
            });
        }
      }
    } catch (err) {
      console.error('Accept application error:', err);
      Alert.alert('Error', 'Failed to update application status');
    }
  };

  const exportApplicationsToExcel = () => {
    if (!selectedEvent || applications.length === 0) {
      Alert.alert('No Data', 'No applications to export');
      return;
    }

    try {
      // Get all additional requirement types from the selected event
      const additionalRequirementTypes = (selectedEvent.additional_requirements || []).map((r: { type: string }) => r.type);

      const exportData = applications.map((application, index) => ({
        'S.No': index + 1,
        'Full Name': application.students?.student_profiles?.full_name || application.students?.name || 'N/A',
        'UID': application.students?.uid || 'N/A',
        'Roll Number': application.students?.roll_no || 'N/A',
        'Email': application.students?.email || 'N/A',
        'Class': application.students?.student_profiles?.class || 'N/A',
        'Application Status': application.application_status.toUpperCase(),
        'Applied Date': formatDate(application.applied_at),
        'Admin Notes': application.admin_notes || 'No notes',
        'Resume Link': application.students?.student_profiles?.resume_url 
          ? `=HYPERLINK("${application.students.student_profiles.resume_url}","View Resume")`
          : 'Not uploaded',
        'Offer Letter Link': application.offer_letter_url 
          ? `=HYPERLINK("${application.offer_letter_url}","View Offer Letter")`
          : (application.application_status === 'accepted' ? 'Not uploaded' : 'Not accepted'),
        // Add additional requirement submission links
        ...additionalRequirementTypes.reduce((acc, type) => {
          const reqLabel = type.replace('_', ' ').split(' ').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
          ).join(' ');
          const reqKey = `${reqLabel} Link`;
          
          // Find the submission for this additional requirement type
          const submission = application.student_requirement_submissions?.find(sub => 
            sub.placement_requirements.type === type
          );
          
          if (submission?.file_url) {
            acc[reqKey] = `=HYPERLINK("${submission.file_url}","View ${reqLabel}")`;
          } else {
            acc[reqKey] = 'Not submitted';
          }
          return acc;
        }, {} as Record<string, string>),
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);

      const colWidths = [
        { wch: 6 },   // S.No
        { wch: 20 },  // Full Name
        { wch: 12 },  // UID
        { wch: 15 },  // Roll Number
        { wch: 25 },  // Email
        { wch: 8 },   // Class
        { wch: 15 },  // Application Status
        { wch: 12 },  // Applied Date
        { wch: 15 },  // Admin Notes
        { wch: 15 },  // Resume Link
        { wch: 18 },  // Offer Letter Link
        // Add column widths for additional requirement links
        ...Array(additionalRequirementTypes.length).fill({ wch: 18 }),
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Applications');

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${selectedEvent.company_name}_${selectedEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Applications_${timestamp}.xlsx`;

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      FileSaver.default.saveAs(blob, filename);

      Alert.alert('Success', `Excel file downloaded successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export applications to Excel');
    }
  };


  const addAdditionalRequirement = (type: string) => {
    if (newEvent.additional_requirements.some(req => req.type === type)) {
      return; // Already added
    }
    setNewEvent(prev => ({
      ...prev,
      additional_requirements: [...prev.additional_requirements, { type, required: false }]
    }));
  };

  const removeAdditionalRequirement = (type: string) => {
    setNewEvent(prev => ({
      ...prev,
      additional_requirements: prev.additional_requirements.filter(req => req.type !== type)
    }));
  };

  const toggleRequirementRequired = (type: string) => {
    setNewEvent(prev => ({
      ...prev,
      additional_requirements: prev.additional_requirements.map(req =>
        req.type === type ? { ...req, required: !req.required } : req
      )
    }));
  };

  const requirementTypes = [
    { type: 'video_introduction', label: 'Video Introduction' },
    { type: 'portfolio', label: 'Portfolio' },
    { type: 'cover_letter', label: 'Cover Letter' },
    { type: 'certificates', label: 'Certificates' },
    { type: 'project_demo', label: 'Project Demo' },
    { type: 'coding_sample', label: 'Coding Sample' },
  ];
  return (
    <LinearGradient colors={['#667eea', '#764ba2']} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Placement Management</Text>
        <TouchableOpacity style={styles.createButton} onPress={() => setShowCreateModal(true)}>
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Briefcase size={24} color="#007AFF" />
            <Text style={styles.statNumber}>{events.length}</Text>
            <Text style={styles.statLabel}>Active Events</Text>
          </View>
        </View>

        <View style={styles.eventsList}>
          {events.map((event) => (
            <View key={event.id} style={styles.eventCard}>
              <View style={styles.eventHeader}>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <Text style={styles.companyName}>{event.company_name}</Text>
                </View>
              </View>
              
              <Text style={styles.eventDescription}>{event.description}</Text>
              <Text style={styles.eventRequirements}>{event.requirements}</Text>
              
              <View style={styles.eligibleClasses}>
                <Text style={styles.eligibleClassesLabel}>Eligible Classes:</Text>
                <View style={styles.classChips}>
                  {event.eligible_classes?.map((className) => (
                    <View key={className} style={styles.classChip}>
                      <Text style={styles.classChipText}>{className}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <Text style={styles.eventDate}>Created: {formatDate(event.created_at)}</Text>
              
              <TouchableOpacity style={styles.viewButton} onPress={() => viewApplications(event)}>
                <Eye size={16} color="#007AFF" />
                <Text style={styles.viewButtonText}>View Applications</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Create Event Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Placement Event</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <X size={24} color="#1C1C1E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Software Developer Position"
                value={newEvent.title}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, title: text }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Company Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., NIQ, Google, Microsoft"
                value={newEvent.company_name}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, company_name: text }))}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the position..."
                value={newEvent.description}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, description: text }))}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Requirements</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="e.g., Minimum 70% in academics..."
                value={newEvent.requirements}
                onChangeText={(text) => setNewEvent(prev => ({ ...prev, requirements: text }))}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Eligible Classes *</Text>
              <View style={styles.classSelectionContainer}>
                {['TYIT', 'TYSD', 'SYIT', 'SYSD'].map((className) => (
                  <TouchableOpacity
                    key={className}
                    style={[
                      styles.classOption,
                      newEvent.eligible_classes.includes(className) && styles.classOptionSelected
                    ]}
                    onPress={() => {
                      const updatedClasses = newEvent.eligible_classes.includes(className)
                        ? newEvent.eligible_classes.filter(c => c !== className)
                        : [...newEvent.eligible_classes, className];
                      setNewEvent({ ...newEvent, eligible_classes: updatedClasses });
                    }}
                  >
                    <Text style={[
                      styles.classOptionText,
                      newEvent.eligible_classes.includes(className) && styles.classOptionTextSelected
                    ]}>
                      {className}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Additional Requirements</Text>
              <Text style={styles.sublabel}>Select documents students need to submit</Text>
              
              <View style={styles.requirementTypesContainer}>
                {requirementTypes.map((reqType) => (
                  <TouchableOpacity
                    key={reqType.type}
                    style={[
                      styles.requirementTypeOption,
                      newEvent.additional_requirements.some(req => req.type === reqType.type) && styles.requirementTypeSelected
                    ]}
                    onPress={() => {
                      if (newEvent.additional_requirements.some(req => req.type === reqType.type)) {
                        removeAdditionalRequirement(reqType.type);
                      } else {
                        addAdditionalRequirement(reqType.type);
                      }
                    }}
                  >
                    <Text style={[
                      styles.requirementTypeText,
                      newEvent.additional_requirements.some(req => req.type === reqType.type) && styles.requirementTypeTextSelected
                    ]}>
                      {reqType.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {newEvent.additional_requirements.length > 0 && (
                <View style={styles.selectedRequirements}>
                  <Text style={styles.selectedRequirementsTitle}>Selected Requirements:</Text>
                  {newEvent.additional_requirements.map((req) => (
                    <View key={req.type} style={styles.selectedRequirement}>
                      <Text style={styles.selectedRequirementText}>
                        {requirementTypes.find(rt => rt.type === req.type)?.label || req.type}
                      </Text>
                      <TouchableOpacity
                        style={[styles.requiredToggle, req.required && styles.requiredToggleActive]}
                        onPress={() => toggleRequirementRequired(req.type)}
                      >
                        <Text style={[styles.requiredToggleText, req.required && styles.requiredToggleTextActive]}>
                          {req.required ? 'Required' : 'Optional'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.removeRequirement}
                        onPress={() => removeAdditionalRequirement(req.type)}
                      >
                        <X size={16} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.createEventButton, creating && styles.disabledButton]}
              onPress={createPlacementEvent}
              disabled={creating}
            >
              <Text style={styles.createEventButtonText}>
                {creating ? 'Creating...' : 'Create Event'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {/* Applications Modal */}
      <Modal visible={showApplicationsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {selectedEvent ? `${selectedEvent.company_name} - Applications` : 'Applications'}
            </Text>
            <TouchableOpacity onPress={() => setShowApplicationsModal(false)}>
              <X size={24} color="#1C1C1E" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            {applications.length === 0 ? (
              <View style={styles.emptyApplications}>
                <Text style={styles.emptyText}>No Applications Yet</Text>
              </View>
            ) : (
              <View style={styles.applicationsList}>
                <TouchableOpacity style={styles.exportButton} onPress={exportApplicationsToExcel}>
                  <Download size={16} color="#34C759" />
                  <Text style={styles.exportButtonText}>Export to Excel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.bulkDownloadButton}
                  onPress={() => downloadPlacementDocuments(selectedEvent!)}
                >
                  <Download size={16} color="#FFFFFF" />
                  <Text style={styles.bulkDownloadButtonText}>Download Offer Letters</Text>
                </TouchableOpacity>

                {applications.map((application) => (
                  <View key={application.id} style={styles.applicationCard}>
                    <View style={styles.applicationHeader}>
                      <View style={styles.studentInfo}>
                        <User size={20} color="#007AFF" />
                        <View style={styles.studentDetails}>
                          <Text style={styles.studentName}>
                            {application.students?.student_profiles?.full_name || application.students?.name || 'Unknown'}
                          </Text>
                          <Text style={styles.studentMeta}>
                            {application.students?.uid || 'N/A'} • {application.students?.roll_no || 'N/A'}
                          </Text>
                          <Text style={styles.studentEmail}>{application.students?.email || 'N/A'}</Text>
                          <Text style={styles.studentClass}>
                            Class: {application.students?.student_profiles?.class || 'N/A'}
                          </Text>
                        </View>
                      </View>
                      <View style={[styles.applicationStatus, { backgroundColor: getStatusColor(application.application_status) }]}>
                        <Text style={styles.applicationStatusText}>
                          {application.application_status.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.appliedDate}>Applied: {formatDate(application.applied_at)}</Text>

                    {/* View Offer Letter Button for Accepted Students */}
                    {application.application_status === 'accepted' && application.offer_letter_url && (
                      <TouchableOpacity
                        style={styles.viewOfferLetterButton}
                        onPress={() => {
                          try {
                           // Open the URL directly - it should now display inline
                           if (Platform.OS === 'web') {
                             window.open(application.offer_letter_url, '_blank');
                           } else {
                             Linking.openURL(application.offer_letter_url);
                           }
                          } catch (error) {
                            Alert.alert('Error', 'Failed to open offer letter.');
                          }
                        }}
                      >
                        <FileText size={16} color="#34C759" />
                        <Text style={styles.viewOfferLetterText}>View Offer Letter</Text>
                      </TouchableOpacity>
                    )}

                    {application.application_status !== 'accepted' && (
                      <TouchableOpacity
                        style={styles.acceptButton}
                        onPress={() => acceptApplication(application.id)}
                      >
                        <Text style={styles.acceptButtonText}>Mark as Accepted</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
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
  createButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 12,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B6B6B',
    textAlign: 'center',
  },
  eventsList: {
    gap: 16,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    marginBottom: 8,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  
  eventDescription: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  eventRequirements: {
    fontSize: 14,
    color: '#1C1C1E',
    marginBottom: 12,
  },
  eligibleClasses: {
    marginBottom: 12,
  },
  eligibleClassesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  classChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classChip: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  classChipText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  eventDate: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  viewButtonText: {
    color: '#007AFF',
    fontSize: 14,
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
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1C1C1E',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  classSelectionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  classOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  classOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  classOptionText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  classOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  sublabel: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 12,
  },
  requirementTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  requirementTypeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  requirementTypeSelected: {
    backgroundColor: '#34C759',
    borderColor: '#34C759',
  },
  requirementTypeText: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  requirementTypeTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  selectedRequirements: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  selectedRequirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 12,
  },
  selectedRequirement: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  selectedRequirementText: {
    fontSize: 14,
    color: '#1C1C1E',
    flex: 1,
  },
  requiredToggle: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  requiredToggleActive: {
    backgroundColor: '#FF3B30',
  },
  requiredToggleText: {
    fontSize: 12,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  requiredToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  removeRequirement: {
    padding: 4,
  },
  createEventButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 40,
  },
  createEventButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  emptyApplications: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  applicationsList: {
    gap: 16,
    paddingBottom: 40,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#34C759',
    gap: 8,
  },
  exportButtonText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  bulkDownloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#AF52DE',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginTop: 8,
  },
  bulkDownloadButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#C7C7CC',
  },
  applicationCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  studentMeta: {
    fontSize: 14,
    color: '#6B6B6B',
    marginBottom: 2,
  },
  studentEmail: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 2,
  },
  studentClass: {
    fontSize: 14,
    color: '#6B6B6B',
    fontWeight: '500',
  },
  applicationStatus: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  applicationStatusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  appliedDate: {
    fontSize: 12,
    color: '#6B6B6B',
    marginBottom: 8,
  },
  viewOfferLetterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFF4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#34C759',
    gap: 8,
  },
  viewOfferLetterText: {
    fontSize: 14,
    color: '#34C759',
    fontWeight: '600',
  },
  acceptButton: {
    marginTop: 8,
    backgroundColor: '#34C759',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});