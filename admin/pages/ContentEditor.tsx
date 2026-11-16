import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  Copy,
  ExternalLink,
  History,
  ImagePlus,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { api, ApiError, type FieldHint, type HistoryItem, type MediaItem, type SectionDetail } from '../api';
import { uploadImage } from '../media';
import { Link, setNavigationGuard } from '../router';
import { Button, cx, Dialog, EmptyState, ErrorNote, formatDateTime, humanize, PageHeader, Skeleton, timeAgo, Toggle, useApi, useConfirm, useToast } from '../ui';

// ------------------------------------------------------------------ helpers
type Path = (string | number)[];
type Pair<T = unknown> = { en: T; ar: T };

const clone = <T,>(value: T): T => structuredClone(value);
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isPair = (value: unknown): value is Pair =>
  isObject(value) && Object.keys(value).length === 2 && 'en' in value && 'ar' in value && typeof value.en === typeof value.ar && (typeof value.en === 'string' || Array.isArray(value.en));
const patternOf = (path: Path) => path.map((part) => (typeof part === 'number' ? '*' : part)).join('.');
function hintFor(hints: Record<string, FieldHint>, path: Path): FieldHint | undefined {
  const target = patternOf(path).split('.');
  for (const [pattern, hint] of Object.entries(hints)) {
    const parts = pattern.split('.');
    if (parts.length === target.length && parts.every((part, i) => part === '*' || part === target[i])) return hint;
  }
  return undefined;
}
/** A blank copy of an item (text emptied, lists emptied, numbers 0), to add a new one. */
function blank(value: unknown): unknown {
  if (typeof value === 'string') return '';
  if (typeof value === 'number') return 0;
  if (typeof value === 'boolean') return false;
  if (Array.isArray(value)) return [];
  if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, blank(v)]));
  return value;
}
/** A readable title for an item in a list (its name, title or first line). */
function itemTitle(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isPair(value)) return typeof value.en === 'string' ? value.en : '';
  if (isObject(value)) {
    for (const key of ['name', 'title', 'client', 'question', 'heading', 'caption', 'label', 'slug', 'days', 'quote']) {
      const text = itemTitle(value[key]);
      if (text) return text;
    }
  }
  return '';
}
const contains = (value: unknown, path: Path, filter: string) =>
  !filter || patternOf(path).toLowerCase().includes(filter) || JSON.stringify(value).toLowerCase().includes(filter);

type Ctx = {
  hints: Record<string, FieldHint>;
  templates: Record<string, unknown>;
  filter: string;
  openImagePicker: (current: string, choose: (key: string) => void) => void;
  images: Record<string, MediaItem>;
};
const EditorContext = createContext<Ctx>(null as unknown as Ctx);

// ------------------------------------------------------------------ page
export function ContentEditor({ section }: { section: string }) {
  const { data, setData, error, loading, reload } = useApi<SectionDetail>(`/content/${section}`);
  const media = useApi<{ items: MediaItem[] }>('/media');
  const [doc, setDoc] = useState<unknown>(null);
  const [saved, setSaved] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [picker, setPicker] = useState<{ current: string; choose: (key: string) => void } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  useEffect(() => {
    if (!data) return;
    setDoc(clone(data.doc));
    setSaved(JSON.stringify(data.doc));
    setErrors([]);
  }, [data]);

  const dirty = doc !== null && JSON.stringify(doc) !== saved;

  // Never lose unsaved work: ask before leaving the page or closing the tab.
  useEffect(() => {
    setNavigationGuard(dirty ? () => window.confirm('You have unpublished changes. Leave without publishing them?') : null);
    const onUnload = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      setNavigationGuard(null);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, [dirty]);

  async function publish() {
    if (!dirty || saving) return;
    setSaving(true);
    setErrors([]);
    try {
      await api(`/content/${section}`, { method: 'PUT', body: { doc } });
      setSaved(JSON.stringify(doc));
      setData((current) => (current ? { ...current, doc: clone(doc), customized: true } : current));
      toast({ tone: 'success', text: 'Published. The website shows your changes now.' });
    } catch (err) {
      if (err instanceof ApiError && err.errors.length) setErrors(err.errors);
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not publish.' });
    } finally {
      setSaving(false);
    }
  }

  // Ctrl+S / Cmd+S publishes.
  const publishRef = useRef(publish);
  publishRef.current = publish;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void publishRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function resetToDefault() {
    if (!data) return;
    const ok = await confirm({
      title: 'Restore the original content?',
      text: `“${data.title}” goes back to the website’s original wording and photos. Your current version is kept in the history, so you can bring it back.`,
      confirm: 'Restore original',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/content/${section}`, { method: 'DELETE' });
      toast({ tone: 'success', text: 'Original content restored.' });
      setSaved('');
      reload();
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not restore.' });
    }
  }

  if (error) return <ErrorNote message={error} onRetry={reload} />;
  if (loading || !data || doc === null) return <Skeleton lines={12} />;

  const images = Object.fromEntries((media.data?.items ?? []).map((item) => [item.key, item]));
  const ctx: Ctx = { hints: data.hints, templates: data.templates, filter: filter.trim().toLowerCase(), images, openImagePicker: (current, choose) => setPicker({ current, choose }) };

  return (
    <EditorContext.Provider value={ctx}>
      <div className="page editor">
        <PageHeader
          title={data.title}
          subtitle={data.description}
          back={
            <Link to="/content" className="back-link">
              <ArrowLeft size={15} aria-hidden="true" /> Website content
            </Link>
          }
          actions={
            <>
              <a className="btn btn-secondary" href={data.viewPath} target="_blank" rel="noopener noreferrer">
                <ExternalLink size={16} aria-hidden="true" />
                <span>View on website</span>
              </a>
              <Button icon={<History size={16} />} onClick={() => setHistoryOpen(true)}>
                History
              </Button>
              {data.customized && (
                <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={resetToDefault}>
                  Restore original
                </Button>
              )}
            </>
          }
        />

        <div className="editor-legend">
          <span className="lang-tag">EN</span> English <span className="lang-tag is-ar">AR</span> Arabic. Empty Arabic fields show the English text.
        </div>

        {errors.length > 0 && (
          <div className="alert is-error" role="alert">
            <AlertTriangle size={18} aria-hidden="true" />
            <div>
              <strong>Please fix the following before publishing:</strong>
              <ul>
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {section === 'text' && (
          <div className="search editor-search">
            <Search size={16} aria-hidden="true" />
            <input className="input" type="search" placeholder="Find any wording, e.g. “Plan your event”…" aria-label="Find wording" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
        )}

        <Node value={doc} path={[]} onChange={setDoc} />

        <div className={cx('save-bar', dirty && 'is-visible')} role="region" aria-label="Unpublished changes">
          <span>You have unpublished changes</span>
          <Button
            variant="ghost"
            onClick={() => {
              setDoc(JSON.parse(saved || JSON.stringify(data.doc)));
              setErrors([]);
            }}
          >
            Discard
          </Button>
          <Button variant="primary" loading={saving} onClick={publish}>
            Publish changes
          </Button>
        </div>
      </div>

      <HistoryDialog section={section} open={historyOpen} onClose={() => setHistoryOpen(false)} onRestored={reload} />
      <ImagePicker
        open={Boolean(picker)}
        current={picker?.current ?? ''}
        items={media.data?.items ?? []}
        onUploaded={() => media.reload()}
        onClose={() => setPicker(null)}
        onChoose={(key) => {
          picker?.choose(key);
          setPicker(null);
        }}
      />
    </EditorContext.Provider>
  );
}

// ------------------------------------------------------------------ the form engine
function Node({ value, path, onChange, label }: { value: unknown; path: Path; onChange: (value: unknown) => void; label?: string }) {
  const ctx = useContext(EditorContext);
  const hint = hintFor(ctx.hints, path);
  const key = path[path.length - 1];
  const title = hint?.label ?? label ?? (typeof key === 'string' ? humanize(key) : '');

  if (!contains(value, path, ctx.filter)) return null;
  if (isPair(value)) return <Bilingual value={value} path={path} onChange={onChange} title={title} hint={hint} />;
  if (typeof value === 'string') return <TextField value={value} path={path} onChange={onChange} title={title} hint={hint} />;
  if (typeof value === 'number')
    return (
      <SimpleField title={title} hint={hint}>
        {(id) => <input id={id} className="input input-short" type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />}
      </SimpleField>
    );
  if (typeof value === 'boolean') return <Toggle checked={value} onChange={onChange} label={title} description={hint?.help} />;
  if (Array.isArray(value)) return <ListField value={value} path={path} onChange={onChange} title={title} hint={hint} />;
  if (isObject(value)) {
    const fields = Object.entries(value).map(([k, v]) => <Node key={k} value={v} path={[...path, k]} onChange={(next) => onChange({ ...value, [k]: next })} />);
    if (path.length === 0) return <div className="editor-root">{fields}</div>;
    // Top-level groups (e.g. "Hero", "Contact") fold away, so long sections stay manageable.
    if (path.length === 1)
      return (
        <details className="group card" open={Boolean(ctx.filter) || Object.keys(value).length < 8}>
          <summary>
            <span>{title}</span>
            <ChevronDown size={18} aria-hidden="true" />
          </summary>
          <div className="group-body">{fields}</div>
        </details>
      );
    return (
      <fieldset className="subgroup">
        <legend>{title}</legend>
        {hint?.help && <p className="help">{hint.help}</p>}
        {fields}
      </fieldset>
    );
  }
  return null;
}

function SimpleField({ title, hint, children, extra }: { title: string; hint?: FieldHint; children: (id: string) => ReactNode; extra?: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      {title && (
        <div className="field-label">
          <label htmlFor={id}>{title}</label>
          {extra}
        </div>
      )}
      {children(id)}
      {hint?.help && <p className="help">{hint.help}</p>}
    </div>
  );
}

const LIMITS: Record<string, [number, number]> = { seoTitle: [20, 60], seoDescription: [110, 160] };
function Counter({ text, kind }: { text: string; kind?: string }) {
  const limits = kind ? LIMITS[kind] : undefined;
  if (!limits) return null;
  const n = [...text].length;
  const ok = n >= limits[0] && n <= limits[1];
  return (
    <span className={cx('counter', ok ? 'is-ok' : 'is-warn')} title={`Recommended ${limits[0]}–${limits[1]} characters`}>
      {n}/{limits[1]}
    </span>
  );
}

/** One input for one piece of text, shaped by its hint (image, colour, date, long text…). */
function Input({ id, value, onChange, hint, lang }: { id?: string; value: string; onChange: (value: string) => void; hint?: FieldHint; lang?: 'en' | 'ar' }) {
  const ctx = useContext(EditorContext);
  const dir = lang === 'ar' ? 'rtl' : lang === 'en' ? 'ltr' : undefined;
  const kind = hint?.kind;
  if (kind === 'image') {
    const image = ctx.images[value];
    return (
      <div className="image-field">
        <span className="image-thumb">{image ? <img src={image.src} alt="" /> : <ImagePlus size={20} aria-hidden="true" />}</span>
        <span className="image-meta">
          <strong>{image?.alt || value || 'No image'}</strong>
          <span className="muted small">{image ? `${image.width} × ${image.height}` : value ? 'Not found in the media library' : ''}</span>
        </span>
        <Button id={id} size="sm" onClick={() => ctx.openImagePicker(value, onChange)}>
          Change
        </Button>
      </div>
    );
  }
  if (kind === 'color')
    return (
      <div className="color-field">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => onChange(e.target.value)} aria-label="Pick a colour" />
        <input id={id} className="input input-short" value={value} onChange={(e) => onChange(e.target.value)} dir="ltr" />
      </div>
    );
  if (kind === 'select') {
    const options = hint?.options ?? [];
    const all = options.some((o) => o.value === value) ? options : [{ value, label: value || '—' }, ...options];
    return (
      <select id={id} className="input select" value={value} onChange={(e) => onChange(e.target.value)}>
        {all.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
  const type = kind === 'date' ? 'date' : kind === 'time' ? 'time' : kind === 'email' ? 'email' : kind === 'url' ? 'url' : kind === 'phone' ? 'tel' : 'text';
  const ltr = ['date', 'time', 'email', 'url', 'tel'].includes(type) || kind === 'link' || kind === 'slug';
  const long = kind === 'longtext' || kind === 'seoDescription' || value.length > 90;
  if (long)
    return <TextAreaAuto id={id} value={value} onChange={onChange} dir={dir} lang={lang} />;
  return <input id={id} className={cx('input', lang === 'ar' && 'is-arabic')} type={type} value={value} onChange={(e) => onChange(e.target.value)} dir={ltr ? 'ltr' : dir} lang={lang} />;
}

function TextAreaAuto({ id, value, onChange, dir, lang }: { id?: string; value: string; onChange: (value: string) => void; dir?: string; lang?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 480)}px`;
  }, [value]);
  return <textarea ref={ref} id={id} className={cx('input textarea', lang === 'ar' && 'is-arabic')} rows={2} value={value} onChange={(e) => onChange(e.target.value)} dir={dir} lang={lang} />;
}

function TextField({ value, path, onChange, title, hint }: { value: string; path: Path; onChange: (value: unknown) => void; title: string; hint?: FieldHint }) {
  void path;
  return (
    <SimpleField title={title} hint={hint} extra={<Counter text={value} kind={hint?.kind} />}>
      {(id) => <Input id={id} value={value} onChange={onChange} hint={hint} />}
    </SimpleField>
  );
}

function Bilingual({ value, path, onChange, title, hint }: { value: Pair; path: Path; onChange: (value: unknown) => void; title: string; hint?: FieldHint }) {
  const id = useId();
  if (Array.isArray(value.en)) return <BilingualList value={value as Pair<string[]>} path={path} onChange={onChange} title={title} hint={hint} />;
  const en = value.en as string;
  const ar = value.ar as string;
  return (
    <div className="field bilingual">
      <div className="field-label">
        <label htmlFor={`${id}-en`}>{title}</label>
      </div>
      <div className="bilingual-grid">
        <div>
          <span className="lang-tag">EN</span>
          <Counter text={en} kind={hint?.kind} />
          <Input id={`${id}-en`} value={en} onChange={(next) => onChange({ ...value, en: next })} hint={hint} lang="en" />
        </div>
        <div>
          <span className="lang-tag is-ar">AR</span>
          <Counter text={ar} kind={hint?.kind} />
          <Input id={`${id}-ar`} value={ar} onChange={(next) => onChange({ ...value, ar: next })} hint={hint} lang="ar" />
          {!ar && en && <span className="missing">Arabic missing: the English is shown</span>}
        </div>
      </div>
      {hint?.help && <p className="help">{hint.help}</p>}
    </div>
  );
}

function RowControls({ index, count, onMove, onRemove, onDuplicate, what }: { index: number; count: number; onMove: (to: number) => void; onRemove: () => void; onDuplicate?: () => void; what: string }) {
  return (
    <span className="row-controls">
      <button type="button" className="icon-button is-small" aria-label={`Move ${what} up`} disabled={index === 0} onClick={() => onMove(index - 1)}>
        <ArrowUp size={14} />
      </button>
      <button type="button" className="icon-button is-small" aria-label={`Move ${what} down`} disabled={index === count - 1} onClick={() => onMove(index + 1)}>
        <ArrowDown size={14} />
      </button>
      {onDuplicate && (
        <button type="button" className="icon-button is-small" aria-label={`Duplicate ${what}`} onClick={onDuplicate}>
          <Copy size={14} />
        </button>
      )}
      <button type="button" className="icon-button is-small is-danger" aria-label={`Remove ${what}`} onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </span>
  );
}

const move = <T,>(list: T[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** English and Arabic lists edited row by row, so each line sits next to its translation. */
function BilingualList({ value, path, onChange, title, hint }: { value: Pair<string[]>; path: Path; onChange: (value: unknown) => void; title: string; hint?: FieldHint }) {
  const rows = Math.max(value.en.length, value.ar.length);
  const update = (lang: 'en' | 'ar', index: number, text: string) => {
    const list = [...value[lang]];
    while (list.length < rows) list.push('');
    list[index] = text;
    onChange({ ...value, [lang]: list });
  };
  const pad = (list: string[]) => [...list, ...Array(Math.max(0, rows - list.length)).fill('')];
  const itemHint = hintFor(useContext(EditorContext).hints, [...path, 0]) ?? (hint?.kind === 'longtext' ? hint : undefined);
  return (
    <div className="field bilingual">
      <div className="field-label">
        <span className="label-text">{title}</span>
        <span className="muted small">{rows} items</span>
      </div>
      <ol className="list-editor">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="list-editor-row">
            <span className="row-number">{i + 1}</span>
            <div className="bilingual-grid">
              <div>
                <Input value={value.en[i] ?? ''} onChange={(text) => update('en', i, text)} hint={itemHint} lang="en" />
              </div>
              <div>
                <Input value={value.ar[i] ?? ''} onChange={(text) => update('ar', i, text)} hint={itemHint} lang="ar" />
              </div>
            </div>
            <RowControls
              index={i}
              count={rows}
              what={`item ${i + 1}`}
              onMove={(to) => onChange({ en: move(pad(value.en), i, to), ar: move(pad(value.ar), i, to) })}
              onRemove={() => onChange({ en: pad(value.en).filter((_, k) => k !== i), ar: pad(value.ar).filter((_, k) => k !== i) })}
            />
          </li>
        ))}
      </ol>
      <button type="button" className="link-button add-button" onClick={() => onChange({ en: [...pad(value.en), ''], ar: [...pad(value.ar), ''] })}>
        <Plus size={15} aria-hidden="true" /> Add item
      </button>
      {hint?.help && <p className="help">{hint.help}</p>}
    </div>
  );
}

function ListField({ value, path, onChange, title, hint }: { value: unknown[]; path: Path; onChange: (value: unknown) => void; title: string; hint?: FieldHint }) {
  const ctx = useContext(EditorContext);
  const confirm = useConfirm();
  const [open, setOpen] = useState<number | null>(value.length === 1 ? 0 : null);
  const pattern = patternOf(path);
  const templateKey = Object.keys(ctx.templates).find((p) => {
    if (p === '') return pattern === '';
    const a = p.split('.');
    const b = pattern.split('.');
    return a.length === b.length && a.every((part, i) => part === '*' || part === b[i]);
  });
  const template = templateKey !== undefined ? ctx.templates[templateKey] : value.length ? blank(value[0]) : '';
  const scalar = typeof template === 'string' || typeof template === 'number';
  const itemHint = hintFor(ctx.hints, [...path, 0]);
  const noun = title ? title.replace(/s$/, '').toLowerCase() : 'item';

  async function remove(index: number) {
    if (!scalar && !(await confirm({ title: `Remove this ${noun}?`, text: `“${itemTitle(value[index]) || `${noun} ${index + 1}`}” will be removed when you publish.`, confirm: 'Remove', danger: true }))) return;
    onChange(value.filter((_, i) => i !== index));
    setOpen(null);
  }

  return (
    <div className={cx('field list-field', path.length === 0 && 'is-root')}>
      {title && (
        <div className="field-label">
          <span className="label-text">{title}</span>
          <span className="muted small">{value.length} items</span>
        </div>
      )}
      {hint?.help && <p className="help">{hint.help}</p>}
      {value.length === 0 && <p className="muted small">None yet.</p>}
      {scalar ? (
        <ol className="list-editor">
          {value.map((item, i) => (
            <li key={i} className="list-editor-row">
              <span className="row-number">{i + 1}</span>
              <div className="list-editor-input">
                <Input value={String(item)} onChange={(next) => onChange(value.map((v, k) => (k === i ? next : v)))} hint={itemHint} />
              </div>
              <RowControls index={i} count={value.length} what={`item ${i + 1}`} onMove={(to) => onChange(move(value, i, to))} onRemove={() => remove(i)} />
            </li>
          ))}
        </ol>
      ) : (
        <div className="items">
          {value.map((item, i) => {
            const expanded = open === i || Boolean(ctx.filter);
            const preview = ctx.images[(item as Record<string, string>)?.image ?? (item as Record<string, string>)?.cover ?? ''];
            return (
              <div key={i} className={cx('item card', expanded && 'is-open')}>
                <div className="item-head">
                  <button type="button" className="item-toggle" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : i)}>
                    {preview ? <img className="item-thumb" src={preview.src} alt="" /> : <span className="row-number">{i + 1}</span>}
                    <span className="item-title">{itemTitle(item) || `${humanize(noun)} ${i + 1}`}</span>
                    <ChevronDown size={18} aria-hidden="true" className="chevron" />
                  </button>
                  <RowControls
                    index={i}
                    count={value.length}
                    what={`${noun} ${i + 1}`}
                    onMove={(to) => {
                      onChange(move(value, i, to));
                      setOpen(to);
                    }}
                    onDuplicate={() => {
                      onChange([...value.slice(0, i + 1), clone(item), ...value.slice(i + 1)]);
                      setOpen(i + 1);
                    }}
                    onRemove={() => remove(i)}
                  />
                </div>
                {expanded && (
                  <div className="item-body">
                    <Node value={item} path={[...path, i]} onChange={(next) => onChange(value.map((v, k) => (k === i ? next : v)))} label="" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <Button
        size="sm"
        icon={<Plus size={15} />}
        onClick={() => {
          onChange([...value, clone(template)]);
          if (!scalar) setOpen(value.length);
        }}
      >
        Add {noun}
      </Button>
    </div>
  );
}

// ------------------------------------------------------------------ dialogs
function HistoryDialog({ section, open, onClose, onRestored }: { section: string; open: boolean; onClose: () => void; onRestored: () => void }) {
  const { data, loading, reload } = useApi<{ items: HistoryItem[] }>(open ? `/content/${section}/history` : null);
  const toast = useToast();
  const confirm = useConfirm();
  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  async function restore(item: HistoryItem) {
    const ok = await confirm({ title: 'Restore this version?', text: `The content from ${formatDateTime(item.saved_at)} replaces what is published now. The current version stays in the history.`, confirm: 'Restore version' });
    if (!ok) return;
    try {
      await api(`/content/${section}/history/${item.id}/restore`, { method: 'POST' });
      toast({ tone: 'success', text: 'Version restored and published.' });
      onClose();
      onRestored();
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Could not restore.' });
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Version history">
      <p className="muted small">Each time you publish, the version before it is kept here (the last 30).</p>
      {loading && !data ? (
        <Skeleton lines={4} />
      ) : data?.items.length ? (
        <ul className="history">
          {data.items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.is_default ? 'Original website content' : `Version from ${formatDateTime(item.saved_at)}`}</strong>
                <span className="muted small">
                  Replaced {timeAgo(item.saved_at)}
                  {item.saved_by ? ` by ${item.saved_by}` : ''}
                </span>
              </div>
              <Button size="sm" onClick={() => restore(item)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<History size={22} />} title="No earlier versions yet" text="Versions appear here after you publish changes." />
      )}
    </Dialog>
  );
}

function ImagePicker({ open, current, items, onClose, onChoose, onUploaded }: { open: boolean; current: string; items: MediaItem[]; onClose: () => void; onChoose: (key: string) => void; onUploaded: () => void }) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const shown = items.filter((item) => !q || `${item.key} ${item.alt}`.toLowerCase().includes(q));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const item = await uploadImage(files[0]);
      onUploaded();
      toast({ tone: 'success', text: 'Image uploaded.' });
      onChoose(item.key);
    } catch (err) {
      toast({ tone: 'error', text: err instanceof ApiError ? err.message : 'Upload failed.' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Choose an image"
      wide
      footer={
        <>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => upload(e.target.files)} />
          <Button icon={<Upload size={16} />} loading={busy} onClick={() => input.current?.click()}>
            Upload a new image
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="search">
        <Search size={16} aria-hidden="true" />
        <input className="input" type="search" placeholder="Search images…" aria-label="Search images" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="picker-grid">
        {shown.map((item) => (
          <li key={item.key}>
            <button type="button" className={cx('picker-item', item.key === current && 'is-current')} onClick={() => onChoose(item.key)} aria-pressed={item.key === current}>
              <img src={item.src} alt="" loading="lazy" />
              <span>{item.alt || item.key}</span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

