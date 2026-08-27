import { useEffect, useRef, useState } from 'react';
import { api, uploadImage, type ImageRecord } from '../lib/api';
import { Upload, Trash2, Copy, Image as ImageIcon, Check } from 'lucide-react';

export default function ImagesPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.images.list().then(setImages).finally(() => setLoading(false));
  }, []);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true); setError('');
    try {
      const uploaded = await Promise.all(Array.from(files).map(f => uploadImage(f)));
      setImages(prev => [...uploaded.reverse(), ...prev]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally { setUploading(false); }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this image?')) return;
    await api.images.delete(id);
    setImages(prev => prev.filter(i => i.id !== id));
  };

  const fmtSize = (b?: number) => {
    if (!b) return '';
    if (b < 1024) return `${b}B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
    return `${(b / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div className="p-4 md:p-8 space-y-5 md:space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Image Library</h1>
          <p className="text-slate-500 text-sm mt-1">Upload images and copy URLs into your templates</p>
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          uploading ? 'border-brand-300 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-brand-50/50'
        }`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleUpload(e.dataTransfer.files); }}
      >
        <input ref={inputRef} type="file" className="hidden" multiple accept="image/*"
          onChange={e => handleUpload(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-brand-600 font-medium">Uploading…</p>
          </div>
        ) : (
          <>
            <Upload size={28} className="mx-auto mb-3 text-slate-400" />
            <p className="font-medium text-slate-700">Drop images here or click to upload</p>
            <p className="text-sm text-slate-400 mt-1">PNG, JPG, GIF, WebP — stored in Supabase</p>
          </>
        )}
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <div className="card p-16 text-center">
          <ImageIcon size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">No images yet. Upload some to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {images.map(img => (
            <div key={img.id} className="card overflow-hidden group">
              <div className="aspect-square bg-slate-100 overflow-hidden">
                <img src={img.url} alt={img.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
              </div>
              <div className="p-3">
                <p className="text-xs font-medium text-slate-700 truncate">{img.name}</p>
                {img.size_bytes && <p className="text-xs text-slate-400">{fmtSize(img.size_bytes)}</p>}
                <div className="flex gap-1.5 mt-2">
                  <button className="btn-secondary text-xs flex-1 justify-center py-1"
                    onClick={() => copyUrl(img.url)}>
                    {copied === img.url ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                    {copied === img.url ? 'Copied!' : 'Copy URL'}
                  </button>
                  <button className="btn-secondary text-xs py-1 text-red-500 hover:text-red-600"
                    onClick={() => handleDelete(img.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
