import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, uploadImage, type Template, type ContactList, type ImageRecord, type Campaign } from '../lib/api';
import { Save, Eye, ChevronLeft, Image as ImageIcon, FileText, Upload, X, Send } from 'lucide-react';

export default function CampaignEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', subject: '', html_content: '', contact_list_id: '',
    from_name: '', from_email: '', reply_to: '', scheduled_at: '',
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.templates.list(),
      api.contactLists.list(),
      api.images.list(),
      isEdit ? api.campaigns.get(id!) : Promise.resolve(null),
    ]).then(([t, l, imgs, campaign]) => {
      setTemplates(t); setLists(l); setImages(imgs);
      if (campaign) {
        const c = campaign as Campaign;
        setForm({
          name: c.name, subject: c.subject, html_content: c.html_content,
          contact_list_id: c.contact_list_id, from_name: c.from_name || '',
          from_email: c.from_email || '', reply_to: c.reply_to || '',
          scheduled_at: c.scheduled_at ? c.scheduled_at.slice(0, 16) : '',
        });
      }
    }).finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const applyTemplate = (t: Template) => {
    setForm(p => ({ ...p, html_content: t.html_content, subject: p.subject || t.subject }));
    setShowTemplates(false);
  };

  const insertImageUrl = (url: string) => {
    const tag = `<img src="${url}" style="max-width:100%;height:auto;border-radius:8px" alt="" />`;
    setForm(p => ({ ...p, html_content: p.html_content + '\n' + tag }));
    setShowImages(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const img = await uploadImage(e.target.files[0]);
    setImages(prev => [img, ...prev]);
  };

  const save = async (sendNow = false) => {
    if (!form.name || !form.html_content || !form.contact_list_id) {
      setError('Name, HTML content, and a contact list are required'); return;
    }
    setSaving(true); setError('');
    try {
      let campaign: Campaign;
      if (isEdit) {
        campaign = await api.campaigns.update(id!, form);
      } else {
        campaign = await api.campaigns.create(form);
      }
      if (sendNow) {
        await api.campaigns.send(campaign.id);
        navigate('/campaigns');
      } else {
        navigate('/campaigns');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4 shrink-0">
        <button className="text-slate-400 hover:text-slate-600" onClick={() => navigate('/campaigns')}>
          <ChevronLeft size={20} />
        </button>
        <input
          className="font-semibold text-lg border-0 focus:outline-none focus:ring-0 flex-1 min-w-0"
          placeholder="Campaign name…"
          value={form.name}
          onChange={set('name')}
        />
        <div className="flex items-center gap-2">
          <button className={`btn-secondary text-xs ${preview ? 'bg-slate-100' : ''}`}
            onClick={() => setPreview(!preview)}>
            <Eye size={14} /> {preview ? 'Code' : 'Preview'}
          </button>
          <button className="btn-secondary text-xs" onClick={() => setShowTemplates(true)}>
            <FileText size={14} /> Templates
          </button>
          <button className="btn-secondary text-xs" onClick={() => setShowImages(true)}>
            <ImageIcon size={14} /> Images
          </button>
          <button className="btn-secondary text-xs" onClick={() => save(false)} disabled={saving}>
            <Save size={14} /> Save draft
          </button>
          <button className="btn-primary text-xs" onClick={() => save(true)} disabled={saving}>
            <Send size={14} /> {saving ? 'Working…' : 'Send now'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm px-6 py-3 border-b">{error}</div>}

      <div className="flex flex-1 overflow-hidden">
        {/* Settings panel */}
        <div className="w-72 border-r bg-white p-5 space-y-4 overflow-y-auto shrink-0">
          <div>
            <label className="label">Subject line *</label>
            <input className="input" placeholder="Your amazing subject" value={form.subject} onChange={set('subject')} />
          </div>
          <div>
            <label className="label">Contact list *</label>
            <select className="input" value={form.contact_list_id} onChange={set('contact_list_id')}>
              <option value="">Select a list…</option>
              {lists.map(l => (
                <option key={l.id} value={l.id}>{l.name} ({l.subscriber_count.toLocaleString()})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">From name</label>
            <input className="input" placeholder="Your Company" value={form.from_name} onChange={set('from_name')} />
          </div>
          <div>
            <label className="label">From email</label>
            <input className="input" type="email" placeholder="you@company.com" value={form.from_email} onChange={set('from_email')} />
          </div>
          <div>
            <label className="label">Reply-to</label>
            <input className="input" type="email" placeholder="replies@company.com" value={form.reply_to} onChange={set('reply_to')} />
          </div>
          <div>
            <label className="label">Schedule send (optional)</label>
            <input className="input" type="datetime-local" value={form.scheduled_at} onChange={set('scheduled_at')} />
            <p className="text-xs text-slate-400 mt-1">Leave empty to send immediately</p>
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs font-medium text-slate-500 mb-2">MERGE TAGS</p>
            <div className="space-y-1 font-mono text-xs text-slate-600">
              <div className="bg-slate-50 px-2 py-1 rounded">{'{{name}}'}</div>
              <div className="bg-slate-50 px-2 py-1 rounded">{'{{email}}'}</div>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-hidden bg-slate-100">
          {preview ? (
            <iframe
              srcDoc={form.html_content}
              className="w-full h-full border-0 bg-white"
              title="Preview"
              sandbox="allow-same-origin"
            />
          ) : (
            <textarea
              className="w-full h-full p-5 font-mono text-sm resize-none focus:outline-none bg-white border-0"
              value={form.html_content}
              onChange={set('html_content')}
              placeholder="Paste or type your HTML email here…"
              spellCheck={false}
            />
          )}
        </div>
      </div>

      {/* Template picker modal */}
      {showTemplates && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Choose a template</h2>
              <button onClick={() => setShowTemplates(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {templates.length === 0 ? (
                <div className="col-span-3 py-12 text-center text-slate-400">No templates yet. Create one in Templates.</div>
              ) : templates.map(t => (
                <div key={t.id} className="card overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 transition"
                  onClick={() => applyTemplate(t)}>
                  <div className="h-32 bg-slate-50 overflow-hidden relative">
                    <iframe srcDoc={t.html_content} className="w-full h-full scale-[0.4] origin-top-left pointer-events-none"
                      style={{ width: '250%', height: '250%' }} sandbox="allow-same-origin" />
                  </div>
                  <div className="p-3">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Image picker modal */}
      {showImages && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Insert image</h2>
              <div className="flex items-center gap-2">
                <label className="btn-secondary text-xs cursor-pointer">
                  <Upload size={13} /> Upload new
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
                <button onClick={() => setShowImages(false)}><X size={18} className="text-slate-400" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 grid grid-cols-3 md:grid-cols-4 gap-3">
              {images.length === 0 ? (
                <div className="col-span-4 py-12 text-center text-slate-400">No images yet.</div>
              ) : images.map(img => (
                <div key={img.id} className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-brand-500 transition"
                  onClick={() => insertImageUrl(img.url)}>
                  <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
