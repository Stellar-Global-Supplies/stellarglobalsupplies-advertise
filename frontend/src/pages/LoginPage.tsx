import { useEffect } from 'react';
import { Zap } from 'lucide-react';

const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || 'https://apps.stellarglobalsupplies.com';

// No login form — SSO handles everything via the portal
export default function LoginPage() {
  useEffect(() => {
    const callback = encodeURIComponent(window.location.origin + '/dashboard');
    window.location.replace(`${LANDING_URL}/login?callback=${callback}`);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-slate-100 flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center mx-auto">
          <Zap size={24} className="text-white" />
        </div>
        <div>
          <p className="font-semibold text-slate-900">Stellar Advertise</p>
          <p className="text-sm text-slate-500 mt-1">Redirecting to portal…</p>
        </div>
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}
