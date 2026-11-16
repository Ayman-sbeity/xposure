import { useRef, useState, type DragEvent } from 'react';
import { Copy, ExternalLink, ImagePlus, Images, Search, Trash2, Upload } from 'lucide-react';
import { api, ApiError, type MediaItem } from '../api';
import { formatBytes, uploadImage } from '../media';
import { Badge, Button, cx, Dialog, EmptyState, ErrorNote, PageHeader, plural, Skeleton, Tabs, TextInput, useApi, useConfirm, useCopy, useToast } from '../ui';

type View = 'all' | 'uploaded' | 'builtin';

export function MediaLibrary() {
  const { data, setData, error, loading, reload } = useApi<{ items: MediaItem[] }>('/media');
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [uploading, setUploading] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();

  async function upload(files: FileList | File[]) {
    const list = [...files];
    setUploading(list.map((f) => f.name));
    let done = 0;
    for (const file of list) {
      try {
        const item = await uploadImage(file);
        setData((current) => (current ? { items: [...current.items, item] } : current));
        done++;
      } catch (err) {
        toast({ tone: 'error', text: err instanceof ApiError ? err.message : `${file.name} could not be uploaded.` });
      }
      setUploading((names) => names.slice(1));
    }
    if (done) toast({ tone: 'success', text: `${plural(done, 'image')} uploaded. Use them from any image field in Website content.` });
    if (input.current) input.current.value = '';
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length) void upload(event.dataTransfer.files);
  };

  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter((item) => (view === 'all' || (view === 'uploaded') === item.uploaded) && (!q || `${item.key} ${item.alt} ${item.altAr}`.toLowerCase().includes(q)));
  const uploadedCount = data?.items.filter((i) => i.uploaded).length ?? 0;

  return (
    <div className="page" onDragOver={(e) => (e.preventDefault(), setDragging(true))} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
      <PageHeader
        title="Media library"
        subtitle="Photos for the website. Upload JPEG, PNG or WebP images (about 1600 px wide and under 1 MB is ideal), then choose them in Website content."
        actions={
          <>
            <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
            <Button variant="primary" icon={<Upload size={16} />} loading={uploading.length > 0} onClick={() => input.current?.click()}>
              {uploading.length ? `Uploading ${uploading[0]}…` : 'Upload images'}
            </Button>
          </>
        }
      />
      <div className={cx('dropzone', dragging && 'is-active')} onClick={() => input.current?.click()} role="presentation">
        <ImagePlus size={22} aria-hidden="true" />
        <span>Drop images here to upload them</span>
      </div>
      <div className="toolbar">
        <Tabs<View>
          label="Images"
          value={view}
          onChange={setView}
          items={[
            { value: 'all', label: 'All', count: data?.items.length },
            { value: 'uploaded', label: 'Uploaded', count: uploadedCount },
            { value: 'builtin', label: 'Original photos' },
          ]}
        />
        <div className="search">
          <Search size={16} aria-hidden="true" />
          <input className="input" type="search" placeholder="Search by description…" aria-label="Search images" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>
      {error && <ErrorNote message={error} onRetry={reload} />}
      {loading && !data ? (
        <Skeleton lines={6} />
      ) : items.length ? (
        <ul className="media-grid">
          {items.map((item) => (
            <li key={item.key}>
              <button type="button" className="media-card card" onClick={() => setSelected(item)}>
                <span className="media-thumb">
                  <img src={item.src} alt="" loading="lazy" />
                  {item.uploaded && <Badge tone="pink">Uploaded</Badge>}
                </span>
                <span className="media-info">
                  <strong className="truncate">{item.alt || item.key}</strong>
                  <span className="muted small">
                    {item.width} × {item.height}
                    {item.size ? ` · ${formatBytes(item.size)}` : ''}
                  </span>
                  <span className={cx('small', item.usedIn.length ? 'used' : 'muted')}>{item.usedIn.length ? `Used in ${item.usedIn.join(', ')}` : 'Not used yet'}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Images size={22} />} title={q ? 'No images match' : 'No uploaded images yet'} text="Upload photos of your events to use them on the website." />
      )}
      {selected && (
        <MediaDetails
          item={selected}
          onClose={() => setSelected(null)}
          onChanged={(next) => {
            setData((current) => (current ? { items: next ? current.items.map((i) => (i.key === next.key ? next : i)) : current.items.filter((i) => i.key !== selected.key) } : current));
            setSelected(next);
          }}
        />
      )}
    </div>
  );
}

function MediaDetails({ item, onClose, onChanged }: { item: MediaItem; onClose: () => void; onChanged: (item: MediaItem | null) => void }) {
  const [alt, setAlt] = useState(item.alt);
  const [altAr, setAltAr] = useState(item.altAr);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();
  const copy = useCopy();

  async function save() {
    setSaving(true);
    try {
      await api(`/media/${item.key}`, { method: 'PATCH', body: { alt, altAr } });
      onChanged({ ...item, alt, altAr });
      toast({ tone: 'success', text: 'Description saved.' });
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not save.' });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!(await confirm({ title: 'Delete this image?', text: 'It will be removed from the media library permanently.', confirm: 'Delete image', danger: true }))) return;
    try {
      await api(`/media/${item.key}`, { method: 'DELETE' });
      toast({ tone: 'success', text: 'Image deleted.' });
      onChanged(null);
      onClose();
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not delete the image.' });
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={item.uploaded ? 'Uploaded image' : 'Original photo'}
      wide
      footer={
        item.uploaded ? (
          <>
            <Button variant="danger" icon={<Trash2 size={16} />} onClick={remove} disabled={item.usedIn.length > 0} title={item.usedIn.length ? 'Replace it where it is used first' : undefined}>
              Delete
            </Button>
            <span className="spacer" />
            <Button variant="primary" loading={saving} disabled={alt === item.alt && altAr === item.altAr} onClick={save}>
              Save description
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="media-detail">
        <img src={item.src} alt={item.alt} />
        <div>
          <dl className="contact-grid is-single">
            <div>
              <dt>Size</dt>
              <dd>
                {item.width} × {item.height} px{item.size ? ` · ${formatBytes(item.size)}` : ''}
              </dd>
            </div>
            <div>
              <dt>Used in</dt>
              <dd>{item.usedIn.length ? item.usedIn.join(', ') : 'Not used yet'}</dd>
            </div>
            <div>
              <dt>Image name</dt>
              <dd>
                <code>{item.key}</code>
                <button type="button" className="icon-button is-small" aria-label="Copy image name" onClick={() => copy(item.key, 'Image name copied')}>
                  <Copy size={14} />
                </button>
              </dd>
            </div>
          </dl>
          {item.uploaded ? (
            <>
              <TextInput label="Description (English)" help="Read aloud to blind visitors and used by Google. Describe what the photo shows." value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} />
              <TextInput label="Description (Arabic)" value={altAr} onChange={(e) => setAltAr(e.target.value)} maxLength={300} dir="rtl" lang="ar" className="input is-arabic" />
            </>
          ) : (
            <p className="muted small">{item.alt}</p>
          )}
          <a className="link-more" href={item.src} target="_blank" rel="noopener noreferrer">
            Open full size <ExternalLink size={14} aria-hidden="true" />
          </a>
        </div>
      </div>
    </Dialog>
  );
}
