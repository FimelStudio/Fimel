import type { Asset, Work, Locale } from './model';
export function imageUsage(work: Work, asset: Asset) {
  return (['description','changelog','versions'] as const).flatMap(tab=>Object.entries(work.markdown[tab]).filter(([,body])=>body?.includes(`fimel-asset:${asset.id}`)||!!asset.publicUrl&&body?.includes(asset.publicUrl)).map(([locale])=>({tab,locale:locale as Locale})));
}

export function removeImage(work: Work, assetId: string): Work {
  const featured = work.featuredCoverId === assetId || work.gallery.some(asset => asset.id === assetId && !!asset.publicUrl && asset.publicUrl === work.project.featuredImage);
  return { ...work, gallery: work.gallery.filter(asset => asset.id !== assetId),
    coverId: work.coverId === assetId ? undefined : work.coverId,
    project: featured ? { ...work.project, featuredImage: undefined } : work.project,
    featuredCoverId: work.featuredCoverId === assetId ? undefined : work.featuredCoverId };
}
