import type { Asset, Work, Locale } from './model';
export function imageUsage(work: Work, asset: Asset) {
  return (['description','changelog','versions'] as const).flatMap(tab=>Object.entries(work.markdown[tab]).filter(([,body])=>body?.includes(`fimel-asset:${asset.id}`)||!!asset.publicUrl&&body?.includes(asset.publicUrl)).map(([locale])=>({tab,locale:locale as Locale})));
}
