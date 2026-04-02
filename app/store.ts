'use client';

import { Project, Meeting, WorkPlan } from './types';
import projectsData from '../public/projects.json';

const PROJECTS_KEY = 'fao_projects';
const MEETINGS_KEY = 'fao_meetings';
const WORK_PLANS_KEY = 'fao_work_plans';

function loadProjects(): Project[] {
  if (typeof window === 'undefined') return projectsData as Project[];
  const stored = localStorage.getItem(PROJECTS_KEY);
  if (stored) {
    const parsed: Project[] = JSON.parse(stored);
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

function loadWorkPlans(): WorkPlan[] {
  if (typeof window === 'undefined') return [];
  const stored = localStorage.getItem(WORK_PLANS_KEY);
  return stored ? JSON.parse(stored) : [];
}

function saveWorkPlans(plans: WorkPlan[]) {
  localStorage.setItem(WORK_PLANS_KEY, JSON.stringify(plans));
}

export const store = {
  getProjects: loadProjects,
  saveProjects,
  getMeetings: loadMeetings,
  saveMeetings,
  getWorkPlans: loadWorkPlans,
  saveWorkPlans,
};
