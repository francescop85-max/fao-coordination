'use client';

import { useEffect } from 'react';
import { store } from '../store';
import { differenceInHours, differenceInDays, parseISO } from 'date-fns';

export default function EmailAlertService() {
  useEffect(() => {
    const run = async () => {
      if (typeof window === 'undefined') return;
      const username = localStorage.getItem('fao_user');
      if (!username) return;

      const profile = store.getUserProfile(username);
      if (!profile?.email || !profile.emailjsServiceId || !profile.emailjsTemplateId || !profile.emailjsPublicKey) return;

      // Throttle: check at most once every 6 hours
      const now = new Date();
      if (profile.lastAlertCheck) {
        const last = parseISO(profile.lastAlertCheck);
        if (differenceInHours(now, last) < 6) return;
      }

      const allPlans = store.getWorkPlans();
      const today = new Date();

      interface Alert { subject: string; message: string }
      const alerts: Alert[] = [];

      for (const plan of allPlans) {
        for (const task of plan.tasks) {
          const end = task.endDate ? parseISO(task.endDate) : null;
          const daysUntil = end ? differenceInDays(end, today) : null;

          if (profile.notifications.taskDelayed && task.status === 'delayed') {
            alerts.push({
              subject: `[FAO] Task delayed: ${task.title}`,
              message: `Project: ${plan.projectSymbol} – ${plan.projectTitle}\nTask: ${task.title}\nAssignee: ${task.assignee || '—'}\nEnd Date: ${task.endDate}\n\nThis task has been marked as delayed.`,
            });
          }

          if (daysUntil !== null && task.status !== 'completed') {
            if (profile.notifications.upcoming3d && daysUntil >= 0 && daysUntil <= 3) {
              alerts.push({
                subject: `[FAO] Task due in ${daysUntil === 0 ? 'today' : `${daysUntil}d`}: ${task.title}`,
                message: `Project: ${plan.projectSymbol} – ${plan.projectTitle}\nTask: ${task.title}\nAssignee: ${task.assignee || '—'}\nDue: ${task.endDate}\nProgress: ${task.progress}%`,
              });
            } else if (profile.notifications.upcoming7d && daysUntil > 3 && daysUntil <= 7) {
              alerts.push({
                subject: `[FAO] Task due in ${daysUntil}d: ${task.title}`,
                message: `Project: ${plan.projectSymbol} – ${plan.projectTitle}\nTask: ${task.title}\nAssignee: ${task.assignee || '—'}\nDue: ${task.endDate}\nProgress: ${task.progress}%`,
              });
            }

            if (profile.notifications.milestones && task.priority === 'critical' && daysUntil >= 0 && daysUntil <= 7) {
              alerts.push({
                subject: `[FAO] Critical milestone due in ${daysUntil}d: ${task.title}`,
                message: `Project: ${plan.projectSymbol} – ${plan.projectTitle}\nMilestone: ${task.title}\nDue: ${task.endDate}\nProgress: ${task.progress}%`,
              });
            }
          }
        }
      }

      if (alerts.length === 0) {
        store.saveUserProfile({ ...profile, lastAlertCheck: now.toISOString() });
        return;
      }

      try {
        const emailjs = await import('@emailjs/browser');
        emailjs.init(profile.emailjsPublicKey);
        for (const alert of alerts) {
          await emailjs.send(profile.emailjsServiceId, profile.emailjsTemplateId, {
            to_email: profile.email,
            subject: alert.subject,
            message: alert.message,
            user_name: username,
          }).catch(() => { /* swallow individual send errors */ });
        }
      } catch {
        // EmailJS load failure — don't block the app
      }

      store.saveUserProfile({ ...profile, lastAlertCheck: now.toISOString() });
    };

    run();
  }, []);

  return null;
}
