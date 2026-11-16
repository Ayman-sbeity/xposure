import type { ImgHTMLAttributes } from 'react';
import { assets, assetUrl, type Asset, type AssetKey } from '../content/assets';
import { useI18n } from '../i18n';

type PhotoProps = { name: AssetKey; priority?: boolean } & Omit<
  ImgHTMLAttributes<HTMLImageElement>,
  'src' | 'width' | 'height' | 'loading' | 'fetchPriority'
>;

/** Local photo with intrinsic size (prevents layout shift) and lazy loading by default. */
export function Photo({ name, priority = false, alt, ...props }: PhotoProps) {
  const { locale } = useI18n();
  // A photo removed from the media library never breaks the page; it is just left out.
  const asset = (assets as Record<string, Asset>)[name];
  if (!asset) return null;
  return (
    <img
      {...props}
      src={assetUrl(name)}
      width={asset.width}
      height={asset.height}
      alt={alt ?? (locale === 'ar' ? asset.altAr : asset.alt)}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding={priority ? 'sync' : 'async'}
    />
  );
}
