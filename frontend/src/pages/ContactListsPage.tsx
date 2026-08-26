import { useEffect, useRef, useState } from 'react';
import { api, type ContactList, type AddEmailsResult } from '../lib/api';
import { Plus, Trash2, RefreshCw, Users, X, Upload, MailPlus } from 'lucide-react';

function AddListModal({ onClose, onAdd }: { onClose: () => void; onAdd: (l: ContactList) => void }) {
  const [sourceType, setSourceType] = useState<'neon' | 'manual'>('neon');
  const [form, setForm] = useState({
    name: '', neon_table_name: '', neon_email_column: 'email', neon_name_column: 'name', description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.name) { setError('Name is required'); return; }
    if (sourceType === 'neon' && !form.neon_table_name) { setError('NeonDB table name required'); return; }
    setLoading(true);
    try {
      const list = await api.contactLists.create({ ...form, source_type: sourceType });
      if (sourceType === 'neon') {
        // Auto-sync to get count
        await api.contactLists.sync(list.id).catch(() => {});
      }
      const updated = await api.contactLists.list();
      onAdd(updated.find(l => l.id === list.id) || list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  };

  const field = (key: keyof typeof form, label: string, placeholder: string, hint?: string) => (
    <div>
      <label className="label">{label}</label>
      <input className="input" placeholder={placeholder}
        value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add Contact List</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

        <div className="flex gap-2 bg-slate-100 rounded-lg p-1">
          <button
            className={`flex-1 py-1.5 text-sm rounded-md ${sourceType === 'neon' ? 'bg-white shadow font-medium' : 'text-slate-500'}`}
            onClick={() => setSourceType('neon')}
          >
            NeonDB table
          </button>
          <button
            className={`flex-1 py-1.5 text-sm rounded-md ${sourceType === 'manual' ? 'bg-white shadow font-medium' : 'text-slate-500'}`}
            onClick={() => setSourceType('manual')}
          >
            Manual emails
          </button>
        </div>

        {field('name', 'List name', 'Newsletter subscribers')}

        {sourceType === 'neon' ? (
          <>
            {field('neon_table_name', 'NeonDB table or view', 'subscribers', 'The table/view in your NeonDB that contains contacts')}
            {field('neon_email_column', 'Email column', 'email', 'Column name that holds email addresses')}
            {field('neon_name_column', 'Name column', 'name', 'Column name for recipient names (used in {{name}} merge tag)')}
          </>
        ) : (
          <p className="text-xs text-slate-400 -mt-1">
            You'll add emails (paste or CSV upload) after creating this list. No name field — emails only.
          </p>
        )}

        {field('description', 'Description (optional)', 'Monthly newsletter list')}
        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1 justify-center" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex-1 justify-center" onClick={submit} disabled={loading}>
            {loading ? 'Adding…' : 'Add List'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddEmailsModal({ list, onClose, onDone }: {
  list: ContactList; onClose: () => void; onDone: (subscriberCount: number) => void;
}) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AddEmailsResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    setText(content);
  };

  const submit = async () => {
    if (!text.trim()) { setError('Paste some emails or upload a CSV first'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.contactLists.addEmails(list.id, { text });
      setResult(res);
      onDone(res.subscriber_count);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">Add Emails to "{list.name}"</h2>
          <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

        {result ? (
          <div className="bg-green-50 text-slate-700 text-sm p-4 rounded-lg space-y-1">
            <div><strong>{result.added}</strong> emails added</div>
            <div className="text-slate-500">
              {result.already_in_list} already in list · {result.duplicates_in_batch} duplicate in file ·{' '}
              {result.invalid_format} invalid format · {result.no_mail_server} no mail server (rejected)
            </div>
          </div>
        ) : (
          <>
            <div>
              <label className="label">CSV file (must have an "email" column)</label>
              <button
                className="btn-secondary w-full justify-center"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={14} /> Upload CSV
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
            </div>

            <div className="text-center text-xs text-slate-400">— or paste below —</div>

            <div>
              <label className="label">Paste emails (one per line, or comma-separated)</label>
              <textarea
                className="input min-h-[160px] font-mono text-xs"
                placeholder={'jane@example.com\njohn@example.com'}
                value={text}
                onChange={e => setText(e.target.value)}
              />
            </div>
            <p className="text-xs text-slate-400">
              Each email is checked for valid format and a working mail server before saving.
              Invalid or unreachable domains are skipped automatically.
            </p>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button className="btn-secondary flex-1 justify-center" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button className="btn-primary flex-1 justify-center" onClick={submit} disabled={loading}>
              {loading ? 'Checking…' : 'Validate & Add'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ContactListsPage() {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [emailsModalList, setEmailsModalList] = useState<ContactList | null>(null);

  useEffect(() => {
    api.contactLists.list().then(setLists).finally(() => setLoading(false));
  }, []);

  const syncList = async (id: string) => {
    setSyncing(id);
    try {
      const result = await api.contactLists.sync(id) as { subscriber_count: number };
      setLists(prev => prev.map(l => l.id === id ? { ...l, subscriber_count: result.subscriber_count, last_synced_at: new Date().toISOString() } : l));
    } finally { setSyncing(null); }
  };

  const deleteList = async (id: string) => {
    if (!confirm('Delete this list?')) return;
    await api.contactLists.delete(id);
    setLists(prev => prev.filter(l => l.id !== id));
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contact Lists</h1>
          <p className="text-slate-500 text-sm mt-1">Sourced from NeonDB or added manually</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add List
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : lists.length === 0 ? (
        <div className="card p-16 text-center">
          <Users size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 mb-4">No contact lists yet.</p>
          <button className="btn-primary mx-auto" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Add your first list
          </button>
        </div>
      ) : (
        <div className="card divide-y">
          {lists.map(list => (
            <div key={list.id} className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center shrink-0">
                <Users size={18} className="text-brand-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900">{list.name}</div>
                <div className="text-sm text-slate-500 flex items-center gap-3 mt-0.5">
                  {list.source_type === 'manual' ? (
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">manual</span>
                  ) : (
                    <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{list.neon_table_name}</span>
                  )}
                  {list.description && <span>{list.description}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-lg font-bold text-slate-900">{list.subscriber_count.toLocaleString()}</div>
                <div className="text-xs text-slate-400">contacts</div>
                {list.last_synced_at && (
                  <div className="text-xs text-slate-300 mt-0.5">
                    synced {new Date(list.last_synced_at).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {list.source_type === 'manual' ? (
                  <button className="btn-secondary text-xs" onClick={() => setEmailsModalList(list)}>
                    <MailPlus size={13} /> Add Emails
                  </button>
                ) : (
                  <button className="btn-secondary text-xs" onClick={() => syncList(list.id)} disabled={syncing === list.id}>
                    <RefreshCw size={13} className={syncing === list.id ? 'animate-spin' : ''} />
                    Sync
                  </button>
                )}
                <button className="btn-secondary text-xs text-red-500" onClick={() => deleteList(list.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddListModal
          onClose={() => setShowModal(false)}
          onAdd={l => { setLists(prev => [...prev, l]); setShowModal(false); }}
        />
      )}

      {emailsModalList && (
        <AddEmailsModal
          list={emailsModalList}
          onClose={() => setEmailsModalList(null)}
          onDone={(count) => setLists(prev => prev.map(l => l.id === emailsModalList.id ? { ...l, subscriber_count: count } : l))}
        />
      )}
    </div>
  );
}