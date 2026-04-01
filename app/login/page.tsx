'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Credentials — change these to your preferred username/password
const CREDENTIALS = [
  { username: 'fao.ukraine', password: 'FAO2026!' },
  { username: 'admin', password: 'admin' },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    setTimeout(() => {
      const valid = CREDENTIALS.some(
        c => c.username === username && c.password === password
      );
      if (valid) {
        localStorage.setItem('fao_auth', 'true');
        localStorage.setItem('fao_user', username);
        router.replace('/');
      } else {
        setError('Invalid username or password.');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#003f7d] to-[#007bc0] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo card */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <span className="text-[#003f7d] font-bold text-xl">FAO</span>
          </div>
          <h1 className="text-white text-2xl font-bold">FAO Ukraine</h1>
          <p className="text-blue-200 text-sm mt-1">Programme Coordination Hub</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-6 space-y-4"
        >
          <h2 className="text-slate-700 font-semibold text-base">Sign in to continue</h2>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username</label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="input-sm w-full"
              placeholder="fao.ukraine"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Password</label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-sm w-full"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#007bc0] hover:bg-[#006aa0] text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-blue-300 text-xs mt-6">
          FAO Ukraine Country Office · Internal tool
        </p>
      </div>
    </div>
  );
}
