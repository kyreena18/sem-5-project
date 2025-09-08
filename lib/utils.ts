export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const getRequirementLabel = (type: string) => {
  const labels: Record<string, string> = {
    video_introduction: 'Video Introduction',
    portfolio: 'Portfolio',
    cover_letter: 'Cover Letter',
    certificates: 'Certificates',
    project_demo: 'Project Demo',
    coding_sample: 'Coding Sample',
  };
  return labels[type] || type.replace('_', ' ').toUpperCase();
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'accepted': return '#34C759';
    case 'rejected': return '#FF3B30';
    case 'applied': return '#007AFF';
    case 'approved': return '#34C759';
    default: return '#FF9500';
  }
};