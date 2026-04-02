'use client';

import { useEffect, useState } from 'react';
import { store } from '../store';
import { UserProfile } from '../types';
import { User, Bell, Mail, Check, Send } from 'lucide-react';

const DEFAULT_PROFILE = (username: string): UserProfile => ({
  username,
  email: '',
  notifications: {
    taskDelayed: true,
    upcoming3d: true,
    upcoming7d: false,
    milestones: true,
  },
  lastAlertCheck: '',
});

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const emailjsConfigured =
    !!process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID &&
    !!process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID &&
    !!process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

  useEffect(() => {
    const username = localStorage.getItem('fao_user') ?? '';
    const stored = store.getUserProfile(username);
    setProfile(stored ?? DEFAULT_PROFILE(username));
  }, []);

  const save = () => {
    if (!profile) return;
    store.saveUserProfile(profile);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const sendTestEmail = async () => {
    if (!profile?.email) return;
    setTesting(true);
    setTestResult(null);
    try {
      const emailjs = await import('@emailjs/browser');
      emailjs.init(process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!);
      await emailjs.send(
        process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
        process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
        {
          to_email: profile.email,
          subject: '[FAO] Email notification test',
          message: 'Your FAO Programme Hub notifications are set up correctly. You will receive alerts at this address.',
          user_name: profile.username,
        }
      );
      setTestResult({ ok: true, msg: 'Test email sent — check your inbox.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ ok: false, msg: `Failed: ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  if (!profile) return null;

  const notifOptions: { key: keyof UserProfile['notifications']; label: string; description: string }[] = [
    { key: 'taskDelayed',  label: 'Task delays',              description: 'When a task status is set to "Delayed"' },
    { key: 'upcoming3d',  label: 'Due in 3 days',             description: 'When a task end date is within 3 days' },
    { key: 'upcoming7d',  label: 'Due in 7 days',             description: 'When a task end date is within 7 days' },
    { key: 'milestones',  label: 'Critical milestones',       description: 'When a critical-priority task is due within 7 days' },
  ];

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <User size={22} className="text-[#003f7d]" />
          My Profile
        </h1>
        <p className="text-sm text-slate-500 mt-1">Set your email address and choose which alerts to receive</p>
      </div>

      <div className="space-y-5">
        {/* Email */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Mail size={15} className="text-slate-500" />
            Email address
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Your email</label>
              <input
                type="email"
                value={profile.email}
                onChange={e => setProfile({ ...profile, email: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="your.name@fao.org"
              />
              <p className="text-xs text-slate-400 mt-1">Alert notifications will be sent to this address.</p>
            </div>

            {emailjsConfigured && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={sendTestEmail}
                  disabled={testing || !profile.email}
                  className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-600 text-sm rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={13} />
                  {testing ? 'Sending…' : 'Send test email'}
                </button>
                {testResult && (
                  <span className={`text-xs flex items-center gap-1 ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                    <Check size={12} />
                    {testResult.msg}
                  </span>
                )}
              </div>
            )}

            {!emailjsConfigured && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Email notifications are not yet configured for this app. Contact your administrator.
              </p>
            )}
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <Bell size={15} className="text-slate-500" />
            Notification preferences
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Alerts are checked once every 6 hours while you are logged in.
          </p>
          <div className="space-y-4">
            {notifOptions.map(({ key, label, description }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={profile.notifications[key]}
                    onChange={e => setProfile({
                      ...profile,
                      notifications: { ...profile.notifications, [key]: e.target.checked },
                    })}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${
                    profile.notifications[key] ? 'bg-[#003f7d]' : 'bg-slate-200'
                  }`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      profile.notifications[key] ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium text-slate-700">{label}</div>
                  <div className="text-xs text-slate-400">{description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#003f7d] text-white font-medium rounded-xl hover:bg-[#002d5a] transition-colors"
        >
          {saved ? <><Check size={16} /> Saved</> : 'Save'}
        </button>
      </div>
    </div>
  );
}
