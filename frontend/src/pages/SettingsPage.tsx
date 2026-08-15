import { useEffect, useState } from 'react';
import { api, type UserSettings } from '../lib/api';
import { Save, Eye, EyeOff, Settings, Mail, User, ExternalLink } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [form, setForm] = useState({
    name: '', gmail_client_id: '', gmail_client_secret: '',
    gmail_refresh_token: '', gmail_sender_email: '',
  });
  const [showSecret, setShowSecret] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.settings.get().then(s => {
      setSettings(s);
      setForm({
        name: s.name || '',
        gmail_client_id: s.gmail_client_id || '',
        gmail_client_secret: s.gmail_client_secret || '',
        gmail_refresh_token: s.gmail_refresh_token || '',
        gmail_sender_email: s.gmail_sender_email || '',
      });
    }).finally(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const save = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      await api.settings.update(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Configure your account and Gmail sending credentials</p>
      </div>

      {/* Profile */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <User size={16} className="text-slate-500" />
          <h2 className="font-semibold text-slate-900">Profile</h2>
        </div>
        <div>
          <label className="label">Display name</label>
          <input className="input" placeholder="Your name" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="label">Email</label>
          <input value={settings?.email || ''} disabled
            className="input bg-slate-50 text-slate-400 cursor-not-allowed" />
          <p className="text-xs text-slate-400 mt-1">Managed by Supabase Auth</p>
        </div>
      </div>

      {/* Gmail */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-slate-500" />
            <h2 className="font-semibold text-slate-900">Gmail OAuth Credentials</h2>
          </div>
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-600 hover:underline flex items-center gap-1"
          >
            Google Console <ExternalLink size={11} />
          </a>
        </div>

        <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg leading-relaxed">
          <strong>Setup:</strong> In Google Cloud Console, create an OAuth 2.0 Client ID (Web app).
          Add your callback URI. Use the OAuth Playground or a local script to exchange your code
          for a refresh token. Paste all three values below.
        </div>

        <div>
          <label className="label">Sender email address</label>
          <input className="input" type="email" placeholder="you@gmail.com"
            value={form.gmail_sender_email} onChange={set('gmail_sender_email')} />
        </div>

        <div>
          <label className="label">Client ID</label>
          <input className="input font-mono text-xs" placeholder="123456789.apps.googleusercontent.com"
            value={form.gmail_client_id} onChange={set('gmail_client_id')} />
        </div>

        <div>
          <label className="label">Client Secret</label>
          <div className="relative">
            <input className="input font-mono text-xs pr-10"
              type={showSecret ? 'text' : 'password'}
              placeholder="GOCSPX-…"
              value={form.gmail_client_secret}
              onChange={set('gmail_client_secret')} />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowSecret(!showSecret)}>
              {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </div>

        <div>
          <label className="label">Refresh Token</label>
          <div className="relative">
            <input className="input font-mono text-xs pr-10"
              type={showToken ? 'text' : 'password'}
              placeholder="1//0g…"
              value={form.gmail_refresh_token}
              onChange={set('gmail_refresh_token')} />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowToken(!showToken)}>
              {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stored encrypted in D1. Never exposed to the browser after save.
          </p>
        </div>
      </div>

      {/* Gmail daily limits info */}
      <div className="card p-5 bg-amber-50 border-amber-200">
        <div className="flex items-start gap-3">
          <Settings size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">Gmail Sending Limits</p>
            <p>Free Gmail: <strong>500 emails/day</strong>. Google Workspace: <strong>2,000/day</strong>.
            The worker sends in batches of 5 with a 1-second delay to respect rate limits.
            For large lists, consider spreading campaigns over multiple days or upgrading to Workspace.</p>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}
      {saved && <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg">✓ Settings saved successfully</div>}

      <button className="btn-primary" onClick={save} disabled={saving}>
        <Save size={16} /> {saving ? 'Saving…' : 'Save settings'}
      </button>
    </div>
  );
}