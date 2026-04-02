'use client';

import { Project, Meeting, WorkPlan, UserProfile } from './types';
import projectsData from '../public/projects.json';

const PROJECTS_KEY = 'fao_projects';
const MEETINGS_KEY = 'fao_meetings';

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return projectsData as Project[];
  const stored = localStorage.getItem(PROJECTS_KEY);
  if (stored) {
    const parsed: Project[] = JSON.parse(stored);
    // Merge any fields that exist in the seed but are missing from stored records
    // (e.g. projectManager added in a later FPMIS export). Match by symbol.
    const seedBySymbol = new Map(
      (projectsData as Project[]).map(p => [p.symbol.trim(), p])
    );
    const merged = parsed.map(p => {
      const seed = seedBySymbol.get(p.symbol.trim());
      if (!seed) return p;
      return {
        ...p,
        projectManager: p.projectManager || seed.projectManager || '',
      };
    });
    // Persist the merged data so next load is clean
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(merged));
    return merged;
  }
  const initial = projectsData as Project[];
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(initial));
  return initial;
}

function saveProjects(projects: Project[]) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function loadMeetings(): Meeting[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(MEETINGS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveMeetings(meetings: Meeting[]) {
  localStorage.setItem(MEETINGS_KEY, JSON.stringify(meetings));
}

const WORK_PLANS_KEY = 'fao_work_plans';
const USER_PROFILES_KEY = 'fao_user_profiles';

function loadWorkPlans(): WorkPlan[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(WORK_PLANS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveWorkPlans(plans: WorkPlan[]) {
  localStorage.setItem(WORK_PLANS_KEY, JSON.stringify(plans));
}

function loadUserProfile(username: string): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_PROFILES_KEY);
  const profiles: UserProfile[] = stored ? JSON.parse(stored) : [];
  return profiles.find(p => p.username === username) ?? null;
}

function saveUserProfile(profile: UserProfile) {
  const stored = localStorage.getItem(USER_PROFILES_KEY);
  const profiles: UserProfile[] = stored ? JSON.parse(stored) : [];
  const idx = profiles.findIndex(p => p.username === profile.username);
  if (idx >= 0) profiles[idx] = profile;
  else profiles.push(profile);
  localStorage.setItem(USER_PROFILES_KEY, JSON.stringify(profiles));
}

export const store = {
  getProjects: loadProjects,
  saveProjects,
  getMeetings: loadMeetings,
  saveMeetings,
  getWorkPlans: loadWorkPlans,
  saveWorkPlans,
  getUserProfile: loadUserProfile,
  saveUserProfile,
};
