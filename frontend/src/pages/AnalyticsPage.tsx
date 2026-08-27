import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type AnalyticsSummary } from '../lib/api';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Send, Eye, MousePointer, UserMinus, ExternalLink } from 'lucide-react';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.analytics.summary().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const o = data?.overall;
  const openRate = o?.total_sent ? ((o.total_opens / o.total_sent) * 100).toFixed(1) : '0.0';
  const clickRate = o?.total_sent ? ((o.total_clicks / o.total_sent) * 100).toFixed(1) : '0.0';
  const unsubRate = o?.total_sent ? ((o.total_unsubs / o.total_sent) * 100).toFixed(2) : '0.00';

  const campaignChartData = data?.campaigns.map(c => ({
    name: c.name.slice(0, 20),
    Sent: c.sent_count,
    Opens: c.open_count,
    Clicks: c.click_count,
  })) ?? [];

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
        <p className="text-slate-500 text-sm mt-1">Campaign performance across all time</p>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Campaigns', value: o?.total_campaigns ?? 0, icon: Send, color: 'text-brand-500' },
          { label: 'Emails Sent', value: (o?.total_sent ?? 0).toLocaleString(), icon: Send, color: 'text-emerald-500' },
          { label: 'Open Rate', value: `${openRate}%`, icon: Eye, color: 'text-violet-500' },
          { label: 'Click Rate', value: `${clickRate}%`, icon: MousePointer, color: 'text-amber-500' },
          { label: 'Unsub Rate', value: `${unsubRate}%`, icon: UserMinus, color: 'text-red-400' },
        ].map(stat => (
          <div key={stat.label} className="stat-card">
            <stat.icon size={18} className={stat.color} />
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
            <p className="text-sm text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Activity timeline */}
      {data?.timeline && data.timeline.length > 0 && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-brand-500" />
            <h2 className="font-semibold text-slate-900">Opens & Clicks — Last 30 Days</h2>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.timeline}>
              <defs>
                <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4361ee" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4361ee" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="opens" stroke="#4361ee" fill="url(#colorOpens)" strokeWidth={2} name="Opens" />
              <Area type="monotone" dataKey="clicks" stroke="#10b981" fill="url(#colorClicks)" strokeWidth={2} name="Clicks" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-campaign bar chart */}
      {campaignChartData.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-5">Campaigns Comparison</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={campaignChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Sent" fill="#cbd5e1" radius={[4,4,0,0]} />
              <Bar dataKey="Opens" fill="#4361ee" radius={[4,4,0,0]} />
              <Bar dataKey="Clicks" fill="#10b981" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaign table */}
      {data?.campaigns && data.campaigns.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-5 border-b">
            <h2 className="font-semibold text-slate-900">All Campaigns</h2>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                {['Campaign','Sent','Opens','Clicks','Unsubs','Open %','Click %',''].map(h => (
                  <th key={h} className={`p-4 font-medium text-slate-500 ${h === 'Campaign' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.campaigns.map(c => {
                const openPct = c.sent_count ? ((c.open_count / c.sent_count) * 100).toFixed(1) : '—';
                const clickPct = c.sent_count ? ((c.click_count / c.sent_count) * 100).toFixed(1) : '—';
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs text-slate-400">{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : ''}</div>
                    </td>
                    <td className="p-4 text-right text-slate-600">{c.sent_count.toLocaleString()}</td>
                    <td className="p-4 text-right text-slate-600">{c.open_count.toLocaleString()}</td>
                    <td className="p-4 text-right text-slate-600">{c.click_count.toLocaleString()}</td>
                    <td className="p-4 text-right text-slate-600">{c.unsub_count.toLocaleString()}</td>
                    <td className="p-4 text-right font-medium text-violet-600">{openPct}{openPct !== '—' ? '%' : ''}</td>
                    <td className="p-4 text-right font-medium text-emerald-600">{clickPct}{clickPct !== '—' ? '%' : ''}</td>
                    <td className="p-4 text-right">
                      <Link to={`/analytics/${c.id}`} className="text-brand-600 hover:underline flex items-center justify-end gap-1 text-xs">
                        Details <ExternalLink size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Top links */}
      {data?.topLinks && data.topLinks.length > 0 && (
        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Top Clicked Links</h2>
          <div className="space-y-2">
            {data.topLinks.map((link, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-mono text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-slate-700 truncate">{link.url}</div>
                  <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full"
                      style={{ width: `${(link.clicks / data.topLinks[0].clicks) * 100}%` }} />
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-700 shrink-0">{link.clicks}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
