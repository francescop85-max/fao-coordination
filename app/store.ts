'use client';

import { Project, Meeting } from './types';
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

export const store = {
  getProjects: loadProjects,
  saveProjects,
  getMeetings: loadMeetings,
  saveMeetings,
};
