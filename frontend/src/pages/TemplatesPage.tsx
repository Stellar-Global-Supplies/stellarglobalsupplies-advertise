import { useEffect, useState } from 'react';
import { api, type Template } from '../lib/api';
import { Plus, Pencil, Trash2, Eye, FileText, X, Save } from 'lucide-react';

const STARTER_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Stellar Global Supplies</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Inter',Arial,sans-serif;background:#f0f4f8;margin:0;padding:0;-webkit-font-smoothing:antialiased}
    @media(max-width:480px){
      .hide-mobile{display:none!important}
      .hero h1{font-size:22px!important}
      .trust-cell,.contact-cell{display:block!important;width:100%!important;border:none!important;padding:8px 0!important}
      .cta-btn{display:block!important;margin:8px 0!important;text-align:center!important}
      .pad{padding:24px 16px!important}
    }
  </style>
</head>
<body>
<div style="background:#f0f4f8;padding:32px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto">
<tr><td>

  <!-- TOP BAR -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#00B98E;border-radius:4px 4px 0 0">
    <tr><td style="padding:9px 24px;font-family:'Inter',Arial,sans-serif;font-size:11px;color:rgba(255,255,255,0.9);text-align:center">
      Special bulk pricing available — <a href="tel:+919637655556" style="color:#fff;font-weight:700;text-decoration:underline">Call +91 9637655556</a>
    </td></tr>
  </table>

  <!-- HEADER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628">
    <tr>
      <td style="padding:22px 28px" valign="middle">
        <!-- Logo image -->
        <a href="https://www.stellarglobalsupplies.com/" style="display:inline-block;text-decoration:none">
          <img src="https://www.stellarglobalsupplies.com/img/logo.jpg"
               alt="Stellar Global Supplies"
               width="140" height="40"
               style="display:block;height:40px;width:auto;object-fit:contain" />
        </a>
      </td>
      <td style="padding:22px 28px;text-align:right" valign="middle" class="hide-mobile">
        <a href="tel:+919637655556" style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.7);font-size:12px;text-decoration:none;display:block;line-height:1.8">+91 9637655556</a>
        <a href="mailto:stellarglobalsupplies@gmail.com" style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.7);font-size:12px;text-decoration:none;display:block;line-height:1.8">stellarglobalsupplies@gmail.com</a>
      </td>
    </tr>
  </table>

  <!-- TEAL RULE -->
  <div style="height:3px;background:linear-gradient(to right,#00B98E,#007a62)"></div>

  <!-- HERO -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#0a1628 0%,#0f2040 60%,#003d2e 100%)">
    <tr><td class="pad" style="padding:44px 32px;text-align:center">
      <div style="display:inline-block;background:rgba(0,185,142,0.15);border:1px solid rgba(0,185,142,0.35);color:#00B98E;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:18px">Featured Product — Special Pricing</div>
      <h1 class="hero" style="font-family:'Inter',Arial,sans-serif;color:#ffffff;font-size:28px;font-weight:800;line-height:1.25;letter-spacing:-0.5px;margin-bottom:14px">
        Premium Industrial Materials,<br /><span style="color:#00B98E">Delivered to Your Doorstep</span>
      </h1>
      <p style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;margin-bottom:26px">Quality-verified SS, MS &amp; Fastening products — precision-sourced from Pune's most trusted industrial partner.</p>
      <a href="https://www.stellarglobalsupplies.com/promotional-products/" class="cta-btn" style="display:inline-block;background:#00B98E;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:700;padding:13px 28px;border-radius:3px;text-decoration:none">View All Promotional Products →</a>
    </td></tr>
  </table>

  <!-- GREETING -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-bottom:1px solid #edf0f4">
    <tr><td class="pad" style="padding:28px 32px">
      <p style="font-family:'Inter',Arial,sans-serif;color:#374151;font-size:15px;line-height:1.7">Dear <strong>{{name}}</strong>, we're excited to share our featured product this month — quality-verified and ready for your next order. Reach out for a custom quote within 24 hours.</p>
    </td></tr>
  </table>

  <!-- SECTION LABEL -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
    <tr><td style="padding:28px 32px 16px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="background:#00B98E;color:#fff;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 10px;border-radius:2px">Product Spotlight</td>
        <td style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:17px;font-weight:700;padding-left:12px">This Month's Featured Product</td>
      </tr></table>
    </td></tr>
  </table>

  <!-- PRODUCT CARD -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff">
    <tr><td style="padding:0 32px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e9ef;border-radius:4px;overflow:hidden">
        <!-- Product Image -->
        <tr><td style="background:#f7f9fb;border-bottom:1px solid #e5e9ef;padding:0">
          <img src="{{product_image_url}}" alt="{{product_name}}" width="556" style="width:100%;max-height:280px;object-fit:cover;display:block" />
        </td></tr>
        <!-- Product Body -->
        <tr><td style="padding:24px">
          <div style="display:inline-block;background:#f0fdf9;border:1px solid #a7f3d0;color:#059669;font-family:'Inter',Arial,sans-serif;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 8px;border-radius:2px;margin-bottom:10px">Quality Verified</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:22px;font-weight:800;letter-spacing:-0.3px;margin-bottom:8px">{{product_name}}</div>
          <p style="font-family:'Inter',Arial,sans-serif;color:#6b7280;font-size:14px;line-height:1.6;margin-bottom:20px">Precision-sourced and quality-verified for demanding industrial applications. Available in multiple sizes and grades — custom specifications welcomed. Backed by our commitment to zero-compromise quality and on-time delivery.</p>
          <!-- Feature strip -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #f0f2f5;padding-top:16px;margin-bottom:20px">
            <tr>
              <td class="trust-cell" width="25%" style="text-align:center;border-right:1px solid #f0f2f5;padding:8px 4px">
                <div style="font-size:16px;margin-bottom:3px">✅</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Quality</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:11px;font-weight:700">100% Verified</div>
              </td>
              <td class="trust-cell" width="25%" style="text-align:center;border-right:1px solid #f0f2f5;padding:8px 4px">
                <div style="font-size:16px;margin-bottom:3px">📦</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Delivery</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:11px;font-weight:700">Pan-India</div>
              </td>
              <td class="trust-cell" width="25%" style="text-align:center;border-right:1px solid #f0f2f5;padding:8px 4px">
                <div style="font-size:16px;margin-bottom:3px">🏷️</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Pricing</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:11px;font-weight:700">Bulk Discounts</div>
              </td>
              <td class="trust-cell" width="25%" style="text-align:center;padding:8px 4px">
                <div style="font-size:16px;margin-bottom:3px">⚡</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#6b7280;font-size:9px;text-transform:uppercase;letter-spacing:0.5px">Quote</div>
                <div style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:11px;font-weight:700">Within 24 hrs</div>
              </td>
            </tr>
          </table>
          <!-- CTAs -->
          <a href="https://www.stellarglobalsupplies.com/promotional-products/" class="cta-btn" style="display:inline-block;background:#0a1628;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:700;padding:12px 22px;border-radius:3px;text-decoration:none;margin-right:10px">Enquire Now</a>
          <a href="tel:+919637655556" class="cta-btn" style="display:inline-block;background:transparent;color:#0a1628;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;padding:11px 18px;border-radius:3px;text-decoration:none;border:1.5px solid #d1d5db">📞 Call for Pricing</a>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <!-- TRUST STRIP -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628">
    <tr><td style="padding:22px 32px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="trust-cell" style="text-align:center;border-right:1px solid rgba(255,255,255,0.08);padding:0 8px">
          <div style="font-family:'Inter',Arial,sans-serif;color:#00B98E;font-size:20px;font-weight:800;line-height:1">500+</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-top:3px">Products</div>
        </td>
        <td class="trust-cell" style="text-align:center;border-right:1px solid rgba(255,255,255,0.08);padding:0 8px">
          <div style="font-family:'Inter',Arial,sans-serif;color:#00B98E;font-size:20px;font-weight:800;line-height:1">100%</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-top:3px">Quality Check</div>
        </td>
        <td class="trust-cell" style="text-align:center;border-right:1px solid rgba(255,255,255,0.08);padding:0 8px">
          <div style="font-family:'Inter',Arial,sans-serif;color:#00B98E;font-size:20px;font-weight:800;line-height:1">3</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-top:3px">Categories</div>
        </td>
        <td class="trust-cell" style="text-align:center;padding:0 8px">
          <div style="font-family:'Inter',Arial,sans-serif;color:#00B98E;font-size:20px;font-weight:800;line-height:1">24h</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.5);font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-top:3px">Quote Turnaround</div>
        </td>
      </tr></table>
    </td></tr>
  </table>

  <!-- CTA BANNER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#00B98E,#007a62)">
    <tr><td class="pad" style="padding:36px 32px;text-align:center">
      <h2 style="font-family:'Inter',Arial,sans-serif;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.3px;margin-bottom:8px">Ready to Place Your Order?</h2>
      <p style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.85);font-size:13px;margin-bottom:22px">Tell us your material, grade, quantity, and timeline — quote back within 24 hours.</p>
      <a href="tel:+919637655556" class="cta-btn" style="display:inline-block;background:#ffffff;color:#00946f;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:800;padding:13px 28px;border-radius:3px;text-decoration:none;margin-right:8px">📞 Call Now</a>
      <a href="mailto:stellarglobalsupplies@gmail.com" class="cta-btn" style="display:inline-block;background:transparent;color:#ffffff;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;padding:12px 20px;border-radius:3px;text-decoration:none;border:1.5px solid rgba(255,255,255,0.6)">Email a Requirement</a>
    </td></tr>
  </table>

  <!-- CONTACT ROW -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-top:1px solid #edf0f4;border-bottom:1px solid #edf0f4">
    <tr><td style="padding:24px 32px">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="contact-cell" style="text-align:center;border-right:1px solid #edf0f4;padding:0 12px 0 0">
          <div style="font-size:16px;margin-bottom:4px">📞</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">Phone</div>
          <a href="tel:+919637655556" style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:12px;font-weight:600;text-decoration:none">+91 9637655556</a>
        </td>
        <td class="contact-cell" style="text-align:center;border-right:1px solid #edf0f4;padding:0 12px">
          <div style="font-size:16px;margin-bottom:4px">✉</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">Email</div>
          <a href="mailto:stellarglobalsupplies@gmail.com" style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:11px;font-weight:600;text-decoration:none">stellarglobalsupplies@gmail.com</a>
        </td>
        <td class="contact-cell" style="text-align:center;padding:0 0 0 12px">
          <div style="font-size:16px;margin-bottom:4px">📍</div>
          <div style="font-family:'Inter',Arial,sans-serif;color:#9ca3af;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:3px">Address</div>
          <span style="font-family:'Inter',Arial,sans-serif;color:#0a1628;font-size:11px;font-weight:500">Survey No-169, Talawade, Pune – 411062</span>
        </td>
      </tr></table>
    </td></tr>
  </table>

  <!-- FOOTER -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a1628;border-radius:0 0 4px 4px">
    <tr><td style="padding:26px 32px;text-align:center">
      <div style="font-family:'Inter',Arial,sans-serif;color:#ffffff;font-size:14px;font-weight:700;margin-bottom:6px">Stellar <span style="color:#00B98E">Global</span> Supplies</div>
      <div style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.4);font-size:11px;line-height:1.6;margin-bottom:14px">
        Survey No-169, Gala No-3, Pandurang Industrial Complex, Rupee Nagar, Talawade, Pune – 411062<br />
        Business Hours: Mon–Sat, 9:00 AM – 6:00 PM
      </div>
      <div style="margin-bottom:16px">
        <a href="https://www.stellarglobalsupplies.com/" style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.45);font-size:11px;text-decoration:none;margin:0 8px">Home</a>
        <a href="https://www.stellarglobalsupplies.com/promotional-products/" style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.45);font-size:11px;text-decoration:none;margin:0 8px">Products</a>
        <a href="https://www.stellarglobalsupplies.com/#contact" style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.45);font-size:11px;text-decoration:none;margin:0 8px">Contact</a>
      </div>
      <div style="font-family:'Inter',Arial,sans-serif;color:rgba(255,255,255,0.25);font-size:10px;line-height:1.6">
        You're receiving this because you're a valued customer or enquired about our products.<br />
        <a href="{{unsubscribe_url}}" style="color:rgba(255,255,255,0.35);text-decoration:underline">Unsubscribe</a>
        &nbsp;·&nbsp; © 2025 Stellar Global Supplies. All rights reserved.
      </div>
    </td></tr>
  </table>

</td></tr>
</table>
</div>
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
  const [productName, setProductName] = useState(template?.product_name || '');
  const [productImageUrl, setProductImageUrl] = useState(template?.product_image_url || '');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Replace merge tags for preview rendering
  const previewHtml = html
    .replace(/\{\{product_name\}\}/gi, productName || 'Sample Product')
    .replace(/\{\{product_image_url\}\}/gi, productImageUrl || 'https://via.placeholder.com/600x400?text=Product+Image');

  const save = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      const saved = template
        ? await api.templates.update(template.id, { name, subject, html_content: html, product_name: productName, product_image_url: productImageUrl })
        : await api.templates.create({ name, subject, html_content: html, product_name: productName, product_image_url: productImageUrl });
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

        <div className="flex gap-4 p-4 border-b flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="label">Template name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Summer Sale 2024" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Default subject line</label>
            <input className="input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Don't miss our summer deals!" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Product name <span className="text-slate-400 font-normal">(replaces {'{{product_name}}'})</span></label>
            <input className="input" value={productName} onChange={e => setProductName(e.target.value)} placeholder="Stellar Pro Widget" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="label">Product image URL <span className="text-slate-400 font-normal">(replaces {'{{product_image_url}}'})</span></label>
            <input className="input" value={productImageUrl} onChange={e => setProductImageUrl(e.target.value)} placeholder="https://example.com/product.jpg" />
          </div>
        </div>

        {error && <div className="mx-4 mt-2 bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

        <div className="flex-1 overflow-hidden">
          {preview ? (
            <iframe
              srcDoc={previewHtml}
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