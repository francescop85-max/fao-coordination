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

// ─── Work Planning Module ────────────────────────────────────────────────────

export type TaskStatus = 'not-started' | 'in-progress' | 'completed' | 'delayed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface WorkTask {
  id: string;
  workPlanId: string;
  projectId: string;
  title: string;
  description: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  status: TaskStatus;
  progress: number;       // 0–100
  priority: TaskPriority;
  dependencies: string[]; // WorkTask ids
  assignee: string;
}

export interface WorkPlan {
  id: string;
  projectId: string;
  projectSymbol: string;
  projectTitle: string;
  projectManager: string;
  createdBy: string;
  lastUpdated: string;    // ISO datetime
  tasks: WorkTask[];
}

export type AlertType = 'task-delayed' | 'upcoming-3d' | 'upcoming-7d' | 'milestone';

export interface UserProfile {
  username: string;
  email: string;
  emailjsServiceId: string;
  emailjsTemplateId: string;
  emailjsPublicKey: string;
  notifications: {
    taskDelayed: boolean;
    upcoming3d: boolean;
    upcoming7d: boolean;
    milestones: boolean;
  };
  lastAlertCheck: string; // ISO datetime
}
