import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Campaign } from '../lib/api';
import { Plus, Pencil, Trash2, Send, BarChart2, Mail, Loader2 } from 'lucide-react';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-600',
    scheduled: 'bg-blue-100 text-blue-700',
    sending: 'bg-yellow-100 text-yellow-700 animate-pulse',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${map[status] || ''}`}>
      {status}
    </span>
  );
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).finally(() => setLoading(false));
  }, []);

  const sendCampaign = async (id: string) => {
    if (!confirm('Send this campaign to all contacts now?')) return;
    setSending(id);
    try {
      await api.campaigns.send(id);
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'sending' } : c));
    } finally { setSending(null); }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign?')) return;
    await api.campaigns.delete(id);
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-slate-500 text-sm mt-1">Create and send email campaigns</p>
        </div>
        <Link to="/campaigns/new" className="btn-primary">
          <Plus size={16} /> New Campaign
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="card p-16 text-center">
          <Mail size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 mb-4">No campaigns yet.</p>
          <Link to="/campaigns/new" className="btn-primary mx-auto">
            <Plus size={16} /> Create your first campaign
          </Link>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-slate-500">Campaign</th>
                <th className="text-left p-4 font-medium text-slate-500">List</th>
                <th className="text-left p-4 font-medium text-slate-500">Status</th>
                <th className="text-right p-4 font-medium text-slate-500">Recipients</th>
                <th className="text-right p-4 font-medium text-slate-500">Sent</th>
                <th className="text-right p-4 font-medium text-slate-500">Date</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {campaigns.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-400 truncate max-w-xs">{c.subject}</div>
                  </td>
                  <td className="p-4 text-slate-600">{c.list_name || '—'}</td>
                  <td className="p-4">{statusBadge(c.status)}</td>
                  <td className="p-4 text-right text-slate-600">{c.total_recipients.toLocaleString()}</td>
                  <td className="p-4 text-right text-slate-600">{c.sent_count.toLocaleString()}</td>
                  <td className="p-4 text-right text-slate-400 text-xs">
                    {c.sent_at ? new Date(c.sent_at).toLocaleDateString() : new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1">
                      {c.status === 'sent' && (
                        <Link to={`/analytics/${c.id}`} className="btn-secondary text-xs py-1">
                          <BarChart2 size={13} /> Report
                        </Link>
                      )}
                      {(c.status === 'draft' || c.status === 'scheduled') && (
                        <>
                          <Link to={`/campaigns/${c.id}/edit`} className="btn-secondary text-xs py-1">
                            <Pencil size={13} />
                          </Link>
                          <button className="btn-primary text-xs py-1" onClick={() => sendCampaign(c.id)}
                            disabled={sending === c.id}>
                            {sending === c.id ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                            Send
                          </button>
                        </>
                      )}
                      {c.status !== 'sending' && (
                        <button className="text-slate-400 hover:text-red-500 p-1.5" onClick={() => deleteCampaign(c.id)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
