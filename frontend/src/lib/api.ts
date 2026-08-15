import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const API = import.meta.env.VITE_API_URL;

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token ?? ''}`,
  };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// Templates
export const api = {
  templates: {
    list: () => apiFetch<Template[]>('/api/templates'),
    create: (data: Partial<Template>) => apiFetch<Template>('/api/templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Template>) => apiFetch<Template>(`/api/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/templates/${id}`, { method: 'DELETE' }),
  },
  images: {
    list: () => apiFetch<ImageRecord[]>('/api/images'),
    save: (data: Partial<ImageRecord>) => apiFetch<ImageRecord>('/api/images', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/images/${id}`, { method: 'DELETE' }),
    getUploadUrl: (filename: string, mime_type: string) =>
      apiFetch<{ signed_url: string; public_url: string; path: string }>('/api/images/upload-url', {
        method: 'POST', body: JSON.stringify({ filename, mime_type })
      }),
  },
  contactLists: {
    list: () => apiFetch<ContactList[]>('/api/contact-lists'),
    create: (data: Partial<ContactList>) => apiFetch<ContactList>('/api/contact-lists', { method: 'POST', body: JSON.stringify(data) }),
    sync: (id: string) => apiFetch(`/api/contact-lists/${id}/sync`, { method: 'POST' }),
    delete: (id: string) => apiFetch(`/api/contact-lists/${id}`, { method: 'DELETE' }),
  },
  campaigns: {
    list: () => apiFetch<Campaign[]>('/api/campaigns'),
    create: (data: Partial<Campaign>) => apiFetch<Campaign>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    get: (id: string) => apiFetch<Campaign>(`/api/campaigns/${id}`),
    update: (id: string, data: Partial<Campaign>) => apiFetch<Campaign>(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => apiFetch(`/api/campaigns/${id}`, { method: 'DELETE' }),
    send: (id: string) => apiFetch(`/api/campaigns/${id}/send`, { method: 'POST' }),
  },
  analytics: {
    summary: () => apiFetch<AnalyticsSummary>('/api/analytics'),
    campaign: (id: string) => apiFetch<CampaignAnalytics>(`/api/analytics/${id}`),
  },
  settings: {
    get: () => apiFetch<UserSettings>('/api/settings'),
    update: (data: Partial<UserSettings>) => apiFetch<UserSettings>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};

// Types for frontend
export interface Template {
  id: string; user_id: string; name: string; subject: string;
  html_content: string; preview_text?: string; thumbnail_url?: string;
  created_at: string; updated_at: string;
}

export interface ImageRecord {
  id: string; user_id: string; name: string; url: string;
  size_bytes?: number; mime_type?: string; created_at: string;
}

export interface ContactList {
  id: string; user_id: string; name: string; neon_table_name: string;
  neon_email_column: string; neon_name_column: string; description?: string;
  subscriber_count: number; last_synced_at?: string; created_at: string;
}

export interface Campaign {
  id: string; user_id: string; name: string; subject: string;
  template_id?: string; contact_list_id: string; html_content: string;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
  scheduled_at?: string; sent_at?: string; from_name?: string;
  from_email?: string; reply_to?: string; total_recipients: number;
  sent_count: number; failed_count: number; list_name?: string;
  created_at: string; updated_at: string;
}

export interface AnalyticsSummary {
  overall: {
    total_campaigns: number; total_sent: number;
    total_opens: number; total_clicks: number; total_unsubs: number;
  };
  campaigns: CampaignRow[];
  timeline: TimelineRow[];
  topLinks: { url: string; clicks: number }[];
}

export interface CampaignRow {
  id: string; name: string; sent_at: string;
  total_recipients: number; sent_count: number; failed_count: number;
  open_count: number; click_count: number; unsub_count: number;
}

export interface TimelineRow { date: string; opens: number; clicks: number; unsubs: number; }

export interface CampaignAnalytics {
  campaign: Campaign;
  events: { event_type: string; count: number; unique_count: number }[];
  sends: { status: string; count: number }[];
  hourly: { hour: string; event_type: string; count: number }[];
  topLinks: { url: string; clicks: number }[];
}

export interface UserSettings {
  id: string; email: string; name?: string;
  gmail_client_id?: string; gmail_client_secret?: string;
  gmail_refresh_token?: string; gmail_sender_email?: string;
}

// Upload image to Supabase storage
export async function uploadImage(file: File): Promise<ImageRecord> {
  const { signed_url, public_url } = await api.images.getUploadUrl(file.name, file.type);
  const res = await fetch(signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Upload failed');
  return api.images.save({ name: file.name, url: public_url, size_bytes: file.size, mime_type: file.type });
}
