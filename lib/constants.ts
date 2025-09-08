export const STATIC_ASSIGNMENTS = [
  {
    type: 'offer_letter',
    title: 'Offer Letter',
    description: 'Upload your internship offer letter from the company. This must be approved before other assignments.',
    bucket: 'internship-offer-letters',
    required: true,
    unlockOthers: true
  },
  {
    type: 'completion_letter',
    title: 'Completion Letter',
    description: 'Upload your internship completion certificate from the company.',
    bucket: 'internship-completion-letters',
    required: true,
    unlockOthers: false
  },
  {
    type: 'weekly_report',
    title: 'Weekly Report',
    description: 'Upload your weekly internship progress reports.',
    bucket: 'internship-weekly-reports',
    required: true,
    unlockOthers: false
  },
  {
    type: 'student_outcome',
    title: 'Student Outcome',
    description: 'Upload your student outcome assessment document.',
    bucket: 'internship-student-outcomes',
    required: true,
    unlockOthers: false
  },
  {
    type: 'student_feedback',
    title: 'Student Feedback',
    description: 'Upload your feedback form about the internship experience.',
    bucket: 'internship-student-feedback',
    required: true,
    unlockOthers: false
  },
  {
    type: 'company_outcome',
    title: 'Company Outcome',
    description: 'Upload the company outcome report or evaluation.',
    bucket: 'internship-company-outcomes',
    required: true,
    unlockOthers: false
  }
];