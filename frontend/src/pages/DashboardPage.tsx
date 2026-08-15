import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AnalyticsSummary, type Campaign } from '../lib/api';
import { Mail, Send, Eye, MousePointer, Plus, ArrowRight, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.ElementType; color: string }) {
  return (
    <div className="stat-card">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
        <Icon size={18} className="text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-900 mt-2">{Number(value).toLocaleString()}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${map[status] || ''}`}>
      {status}
    </span>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.analytics.summary(), api.campaigns.list()]).then(([s, c]) => {
      setSummary(s); setCampaigns(c.slice(0, 5));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const o = summary?.overall;
  const openRate = o?.total_sent ? ((o.total_opens / o.total_sent) * 100).toFixed(1) : '0.0';
  const clickRate = o?.total_sent ? ((o.total_clicks / o.total_sent) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-8 space-y-8 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Campaign performance overview</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Plus size={16} /> New Campaign
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Campaigns" value={o?.total_campaigns ?? 0} icon={Mail} color="bg-brand-500" />
        <StatCard label="Emails Sent" value={o?.total_sent ?? 0} icon={Send} color="bg-emerald-500" />
        <StatCard label="Open Rate" value={`${openRate}%`} icon={Eye} color="bg-violet-500" />
        <StatCard label="Click Rate" value={`${clickRate}%`} icon={MousePointer} color="bg-amber-500" />
      </div>

      {/* Timeline chart */}
      {summary?.timeline && summary.timeline.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={18} className="text-brand-500" />
            <h2 className="font-semibold text-slate-900">Activity — Last 30 Days</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={summary.timeline}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="opens" stroke="#4361ee" strokeWidth={2} dot={false} name="Opens" />
              <Line type="monotone" dataKey="clicks" stroke="#10b981" strokeWidth={2} dot={false} name="Clicks" />
              <Line type="monotone" dataKey="unsubs" stroke="#f59e0b" strokeWidth={2} dot={false} name="Unsubs" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent campaigns */}
      <div className="card">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent Campaigns</h2>
          <Link to="/campaigns" className="text-sm text-brand-600 hover:underline flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Mail size={32} className="mx-auto mb-3 opacity-40" />
            <p>No campaigns yet. <Link to="/campaigns/new" className="text-brand-600 hover:underline">Create your first one.</Link></p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50">
              <tr>
                <th className="text-left p-4 text-slate-500 font-medium">Name</th>
                <th className="text-left p-4 text-slate-500 font-medium">Status</th>
                <th className="text-right p-4 text-slate-500 font-medium">Sent</th>
                <th className="text-right p-4 text-slate-500 font-medium">Opens</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">{c.name}</td>
                  <td className="p-4">{statusBadge(c.status)}</td>
                  <td className="p-4 text-right text-slate-600">{c.sent_count.toLocaleString()}</td>
                  <td className="p-4 text-right text-slate-600">—</td>
                  <td className="p-4 text-right">
                    <Link to={`/analytics/${c.id}`} className="text-brand-600 hover:underline text-xs">Report</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
