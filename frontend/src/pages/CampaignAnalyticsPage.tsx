import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type CampaignAnalytics } from '../lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { ChevronLeft, Eye, MousePointer, UserMinus, Send, AlertCircle, CheckCircle2 } from 'lucide-react';

const COLORS = ['#4361ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function CampaignAnalyticsPage() {
  const { id } = useParams();
  const [data, setData] = useState<CampaignAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.campaign(id!).then(setData).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return <div className="p-8 text-slate-500">Campaign not found.</div>;

  const c = data.campaign;
  const eventMap = Object.fromEntries(data.events.map(e => [e.event_type, e]));
  const sendMap = Object.fromEntries(data.sends.map(s => [s.status, s.count]));
  const openRate = c.sent_count ? ((eventMap.open?.unique_count ?? 0) / c.sent_count * 100).toFixed(1) : '0';
  const clickRate = c.sent_count ? ((eventMap.click?.unique_count ?? 0) / c.sent_count * 100).toFixed(1) : '0';

  const sendPieData = Object.entries(sendMap).map(([name, value]) => ({ name, value: Number(value) }));

  // Build hourly chart (opens by hour)
  const hourlyMap: Record<string, Record<string, number>> = {};
  data.hourly.forEach(h => {
    if (!hourlyMap[h.hour]) hourlyMap[h.hour] = {};
    hourlyMap[h.hour][h.event_type] = h.count;
  });
  const hourlyData = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    return { hour: `${h}:00`, opens: hourlyMap[h]?.open ?? 0, clicks: hourlyMap[h]?.click ?? 0 };
  });

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/analytics" className="text-slate-400 hover:text-slate-600"><ChevronLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{c.name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {c.sent_at ? `Sent ${new Date(c.sent_at).toLocaleDateString('en-US', { dateStyle: 'long' })}` : 'Draft'}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Delivered', value: c.sent_count, icon: CheckCircle2, color: 'text-emerald-500' },
          { label: 'Failed', value: c.failed_count, icon: AlertCircle, color: 'text-red-400' },
          { label: 'Unique Opens', value: eventMap.open?.unique_count ?? 0, sub: `${openRate}% rate`, icon: Eye, color: 'text-violet-500' },
          { label: 'Unique Clicks', value: eventMap.click?.unique_count ?? 0, sub: `${clickRate}% rate`, icon: MousePointer, color: 'text-amber-500' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <s.icon size={18} className={s.color} />
            <p className="text-2xl font-bold text-slate-900 mt-1">{Number(s.value).toLocaleString()}</p>
            <p className="text-sm text-slate-500">{s.label}</p>
            {s.sub && <p className="text-xs text-slate-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Delivery breakdown pie */}
        {sendPieData.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Delivery Status</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={sendPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {sendPieData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Events pie */}
        {data.events.length > 0 && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Events Breakdown</h2>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.events.map(e => ({ name: e.event_type, value: e.count }))}
                  dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}>
                  {data.events.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Hourly opens & clicks */}
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-5">Opens & Clicks by Hour</h2>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="opens" fill="#4361ee" name="Opens" radius={[3,3,0,0]} />
            <Bar dataKey="clicks" fill="#10b981" name="Clicks" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top clicked links */}
      {data.topLinks.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Top Clicked Links</h2>
          <div className="space-y-3">
            {data.topLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 h-5 bg-slate-100 rounded text-xs flex items-center justify-center text-slate-500 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 truncate">{link.url}</p>
                  <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${(link.clicks / data.topLinks[0].clicks) * 100}%` }} />
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">{link.clicks} clicks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subject + send info */}
      <div className="card p-6 grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-slate-400">Subject</span><p className="font-medium mt-0.5">{c.subject}</p></div>
        <div><span className="text-slate-400">From</span><p className="font-medium mt-0.5">{c.from_name} &lt;{c.from_email}&gt;</p></div>
        <div><span className="text-slate-400">Total recipients</span><p className="font-medium mt-0.5">{c.total_recipients.toLocaleString()}</p></div>
        <div><span className="text-slate-400">Unsubscribes</span><p className="font-medium mt-0.5">{eventMap.unsubscribe?.count ?? 0}</p></div>
      </div>
    </div>
  );
}
