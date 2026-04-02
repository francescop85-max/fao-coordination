'use client';

import { useEffect, useState } from 'react';
import { store } from '../store';
import { UserProfile } from '../types';
import { User, Bell, Mail, Check, X, ExternalLink, Info } from 'lucide-react';

const DEFAULT_PROFILE = (username: string): UserProfile => ({
  username,
  email: '',
  emailjsServiceId: '',
  emailjsTemplateId: '',
  emailjsPublicKey: '',
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

  const testEmail = async () => {
    if (!profile) return;
    setTesting(true);
    setTestResult(null);
    try {
      const emailjs = await import('@emailjs/browser');
      emailjs.init(profile.emailjsPublicKey);
      await emailjs.send(profile.emailjsServiceId, profile.emailjsTemplateId, {
        to_email: profile.email,
        subject: '[FAO] Email alert test',
        message: 'Your FAO Programme Hub notification email is configured correctly.',
        user_name: profile.username,
      });
      setTestResult({ ok: true, msg: 'Test email sent successfully.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ ok: false, msg: `Failed: ${msg}` });
    } finally {
      setTesting(false);
    }
  };

  if (!profile) return null;

  const notifOptions: { key: keyof UserProfile['notifications']; label: string; description: string }[] = [
    { key: 'taskDelayed', label: 'Task Delays', description: 'Notify when a task status is set to "Delayed"' },
    { key: 'upcoming3d', label: 'Upcoming tasks (3 days)', description: 'Notify when a task end date is within 3 days' },
    { key: 'upcoming7d', label: 'Upcoming tasks (7 days)', description: 'Notify when a task end date is within 7 days' },
    { key: 'milestones', label: 'Critical milestones', description: 'Notify when a task marked "Critical" priority is due soon' },
  ];

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <User size={22} className="text-[#003f7d]" />
          My Profile
        </h1>
        <p className="text-sm text-slate-500 mt-1">Manage your contact details and notification preferences</p>
      </div>

      <div className="space-y-5">
        {/* Contact info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Mail size={15} className="text-slate-500" />
            Contact Information
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
              <input
                type="text"
                disabled
                value={profile.username}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-400 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Email address</label>
              <input
                type="email"
                value={profile.email}
                onChange={e => setProfile({ ...profile, email: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                placeholder="your@email.com"
              />
              <p className="text-xs text-slate-400 mt-1">Used to receive work plan alert emails</p>
            </div>
          </div>
        </div>

        {/* EmailJS config */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <ExternalLink size={15} className="text-slate-500" />
            EmailJS Configuration
          </h2>
          <p className="text-xs text-slate-500 mb-4">Required to send email alerts from the browser</p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex gap-2 text-xs text-blue-800">
            <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
            <div>
              Create a free account at <strong>emailjs.com</strong>. Set up a service (e.g. Gmail) and an email template.
              Your template must accept these variables: <code className="bg-blue-100 px-1 rounded">to_email</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">subject</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">message</code>,{' '}
              <code className="bg-blue-100 px-1 rounded">user_name</code>.
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Service ID</label>
              <input
                type="text"
                value={profile.emailjsServiceId}
                onChange={e => setProfile({ ...profile, emailjsServiceId: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                placeholder="service_xxxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Template ID</label>
              <input
                type="text"
                value={profile.emailjsTemplateId}
                onChange={e => setProfile({ ...profile, emailjsTemplateId: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                placeholder="template_xxxxxxx"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Public Key</label>
              <input
                type="text"
                value={profile.emailjsPublicKey}
                onChange={e => setProfile({ ...profile, emailjsPublicKey: e.target.value })}
                className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono"
                placeholder="xxxxxxxxxxxxxxxxxxxx"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={testEmail}
              disabled={testing || !profile.email || !profile.emailjsServiceId || !profile.emailjsTemplateId || !profile.emailjsPublicKey}
              className="flex items-center gap-1.5 px-4 py-2 border border-[#003f7d] text-[#003f7d] text-sm rounded-lg hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Mail size={14} />
              {testing ? 'Sending…' : 'Send Test Email'}
            </button>
            {testResult && (
              <span className={`text-xs flex items-center gap-1 ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {testResult.ok ? <Check size={12} /> : <X size={12} />}
                {testResult.msg}
              </span>
            )}
          </div>
        </div>

        {/* Notification preferences */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-2">
            <Bell size={15} className="text-slate-500" />
            Notification Preferences
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Alerts are checked once every 6 hours while you are logged in.
          </p>
          <div className="space-y-3">
            {notifOptions.map(({ key, label, description }) => (
              <label key={key} className="flex items-start gap-3 cursor-pointer group">
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

        {/* Save button */}
        <button
          onClick={save}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[#003f7d] text-white font-medium rounded-xl hover:bg-[#002d5a] transition-colors"
        >
          {saved ? (
            <><Check size={16} /> Saved</>
          ) : (
            'Save Profile'
          )}
        </button>
      </div>
    </div>
  );
}
