import { useEffect, useState } from 'react';
import { supabase } from '../lib/api';

const EXCHANGE_FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sso-exchange`;
const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || 'https://apps.stellarglobalsupplies.com';
const MAX_AGE_MS  = 5 * 60 * 1000;

export default function SSOCallback() {
  const [status, setStatus] = useState('Verifying your session…');
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search);
    const token    = params.get('token');
    const redirect = params.get('redirect') || '/dashboard';
    const ts       = Number(params.get('ts') || 0);

    if (ts && Date.now() - ts > MAX_AGE_MS) {
      setError('This sign-in link has expired. Please return to the portal.');
      return;
    }

    if (!token) {
      const callback = encodeURIComponent(window.location.origin + redirect);
      window.location.replace(`${LANDING_URL}/login?callback=${callback}`);
      return;
    }

    setStatus('Exchanging credentials…');

    fetch(EXCHANGE_FN, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ token }),
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Exchange failed (${res.status})`);
        return data;
      })
      .then(async ({ access_token, refresh_token }: { access_token: string; refresh_token: string }) => {
        setStatus('Setting up your workspace…');
        const { error: authErr } = await supabase.auth.setSession({ access_token, refresh_token });
        if (authErr) throw new Error(authErr.message);
        window.location.replace(redirect);
      })
      .catch((err: Error) => {
        setError(err.message || 'Sign-in failed. Please return to the portal.');
      });
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="card p-8 text-center space-y-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Sign-in error</p>
              <p className="text-sm text-slate-500 mt-1">{error}</p>
            </div>
            <a href={LANDING_URL} className="btn-primary w-full justify-center inline-flex">
              Return to Portal
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-100 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center mx-auto">
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Stellar Advertise</p>
          <p className="text-sm text-slate-500 mt-1">{status}</p>
        </div>
      </div>
    </div>
  );
}
