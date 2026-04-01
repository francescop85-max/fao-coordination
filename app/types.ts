export interface Project {
  id: string;
  symbol: string;
  title: string;
  status: string;
  eod: string;
  nte: string;
  dwhBudget: number;
  availableBudget: number;
  hardCommitment: number;
  softCommitment: number;
  cashBalance: number;
  deliveryLastMonth: number;
  durationYears: number;
  ltoOfficer: string;
  alternateLto: string;
  operationModalities: string;
  donors: string;
  estimate2027: number;
  deliveryProgress: number;
  projectManager: string;
}

export type MeetingType =
  | 'Kick-off Meeting'
  | 'Close-out Meeting'
  | 'Regular Coordination Meeting'
  | 'Donor Review Meeting'
  | 'Ad-hoc Meeting';

export type MeetingStatus = 'Scheduled' | 'Completed' | 'Cancelled';

export interface MeetingAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: string; // ISO datetime
}

export interface Meeting {
  id: string;
  projectId: string;
  projectSymbol: string;
  projectTitle: string;
  projectManager: string;
  date: string; // ISO date string YYYY-MM-DD
  meetingType: MeetingType;
  status: MeetingStatus;
  agenda: string;
  notes: string;
  attendees: string;
  attachments: MeetingAttachment[];
}
