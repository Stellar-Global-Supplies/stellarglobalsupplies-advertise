import { useEffect, useState } from 'react';
import { api, type Template } from '../lib/api';
import { Plus, Pencil, Trash2, Eye, FileText, X, Save } from 'lucide-react';

const STARTER_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Inter,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">
        <!-- Header -->
        <tr><td style="background:#4361ee;padding:32px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:24px">Your Company Name</h1>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px">
          <h2 style="color:#1e293b;margin:0 0 16px">Hello {{name}},</h2>
          <p style="color:#475569;line-height:1.6;margin:0 0 24px">Your email body goes here. Use {{name}} and {{email}} as merge tags.</p>
          <!-- Image placeholder -->
          <!-- <img src="YOUR_IMAGE_URL" style="width:100%;border-radius:8px;margin-bottom:24px" /> -->
          <a href="https://yoursite.com" style="display:inline-block;background:#4361ee;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600">
            Call to Action
          </a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0">
          <p style="color:#94a3b8;font-size:12px;margin:0">© 2024 Your Company. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

interface TemplateModalProps {
  template?: Template;
  onClose: () => void;
  onSave: (t: Template) => void;
}

function TemplateModal({ template, onClose, onSave }: TemplateModalProps) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [html, setHtml] = useState(template?.html_content || STARTER_TEMPLATE);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const saved = template
        ? await api.templates.update(template.id, { name, subject, html_content: html })
        : await api.templates.create({ name, subject, html_content: html });
      onSave(saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">{template ? 'Edit Template' : 'New Template'}</h2>
          <div className="flex items-center gap-2">
            <button className={`btn-secondary text-xs ${preview ? 'bg-slate-100' : ''}`}
              onClick={() => setPreview(!preview)}>
              <Eye size={14} /> {preview ? 'Code' : 'Preview'}
            </button>
            <button className="btn-primary text-xs" onClick={save} disabled={saving}>
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button className="text-slate-400 hover:text-slate-600" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="flex gap-4 p-4 border-b">
          <div className="flex-1">
            <label className="label">Template name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Summer Sale 2024" />
          </div>
          <div className="flex-1">
            <label className="label">Default subject line</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Don't miss our summer deals!" />
          </div>
        </div>

        {error && <div className="mx-4 mt-2 bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

        <div className="flex-1 overflow-hidden">
          {preview ? (
            <iframe
              srcDoc={html}
              className="w-full h-full border-0"
              title="Template preview"
              sandbox="allow-same-origin"
            />
          ) : (
            <textarea
              className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none border-0"
              value={html}
              onChange={e => setHtml(e.target.value)}
              spellCheck={false}
              placeholder="Paste your HTML here…"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; template?: Template }>({ open: false });

  useEffect(() => {
    api.templates.list().then(setTemplates).finally(() => setLoading(false));
  }, []);

  const handleSave = (t: Template) => {
    setTemplates(prev => {
      const idx = prev.findIndex(p => p.id === t.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = t; return n; }
      return [t, ...prev];
    });
    setModal({ open: false });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await api.templates.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="p-8 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Templates</h1>
          <p className="text-slate-500 text-sm mt-1">HTML email templates with merge tags</p>
        </div>
        <button className="btn-primary" onClick={() => setModal({ open: true })}>
          <Plus size={16} /> New Template
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="card p-16 text-center">
          <FileText size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500 mb-4">No templates yet.</p>
          <button className="btn-primary mx-auto" onClick={() => setModal({ open: true })}>
            <Plus size={16} /> Create your first template
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card overflow-hidden group">
              <div className="h-40 bg-slate-50 overflow-hidden relative">
                <iframe
                  srcDoc={t.html_content}
                  className="w-full h-full scale-[0.4] origin-top-left pointer-events-none"
                  style={{ width: '250%', height: '250%' }}
                  title={t.name}
                  sandbox="allow-same-origin"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/20 group-hover:bg-brand-500/10 transition-colors" />
              </div>
              <div className="p-4">
                <h3 className="font-semibold text-slate-900 truncate">{t.name}</h3>
                <p className="text-sm text-slate-500 truncate">{t.subject || 'No subject'}</p>
                <p className="text-xs text-slate-400 mt-1">{new Date(t.updated_at).toLocaleDateString()}</p>
                <div className="flex gap-2 mt-3">
                  <button className="btn-secondary text-xs flex-1 justify-center"
                    onClick={() => setModal({ open: true, template: t })}>
                    <Pencil size={13} /> Edit
                  </button>
                  <button className="btn-secondary text-xs text-red-600 hover:text-red-700"
                    onClick={() => handleDelete(t.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <TemplateModal
          template={modal.template}
          onClose={() => setModal({ open: false })}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
