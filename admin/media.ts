import { api, ApiError, type MediaItem } from './api';

export const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_BYTES = 8 * 1024 * 1024;

/** Upload one image. Checks the type and size first so the visitor gets a clear message. */
export async function uploadImage(file: File, alt = ''): Promise<MediaItem> {
  if (!ACCEPTED.includes(file.type)) throw new ApiError(`${file.name}: please use a JPEG, PNG or WebP image.`, 415);
  if (file.size > MAX_BYTES) throw new ApiError(`${file.name}: the image is larger than 8 MB. Export it smaller (about 1600 px wide is ideal).`, 413);
  const description = alt || file.name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ');
  const result = await api<{ item: MediaItem }>('/media', { method: 'POST', file, headers: { 'X-Image-Alt': encodeURIComponent(description.slice(0, 200)) } });
  return result.item;
}

export const formatBytes = (bytes: number | null) => (bytes === null ? '' : bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);
