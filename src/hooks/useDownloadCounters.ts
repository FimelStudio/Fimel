import { useCallback, useEffect, useMemo, useState } from 'react';
import { countsConfigured, readDownloadCounts, incrementDownloadCount } from '../lib/download-counts';

export type DownloadCounts = Record<string, number>;

const normalizeSlug = (slug: string) => slug.trim();

const countsForSlugs = (slugs: readonly string[], previous: DownloadCounts = {}) => {
  const next: DownloadCounts = {};

  slugs.forEach((slug) => {
    next[slug] = previous[slug] ?? 0;
  });

  return next;
};

export function useDownloadCounters(slugs: readonly string[]) {
  const trackedSlugs = useMemo(
    () => Array.from(new Set(slugs.map(normalizeSlug).filter(Boolean))),
    [slugs],
  );
  const trackedSlugSet = useMemo(() => new Set(trackedSlugs), [trackedSlugs]);
  const [counts, setCounts] = useState<DownloadCounts>(() => countsForSlugs(trackedSlugs));
  const [loading, setLoading] = useState(countsConfigured && trackedSlugs.length > 0);
  const visibleCounts = useMemo(() => countsForSlugs(trackedSlugs, counts), [counts, trackedSlugs]);

  useEffect(() => {
    let isMounted = true;

    if (!countsConfigured || trackedSlugs.length === 0) {
      return () => {
        isMounted = false;
      };
    }

    readDownloadCounts(trackedSlugs)
      .then((data) => {
        if (!isMounted) {
          return;
        }

        setCounts((previous) => {
          const next = countsForSlugs(trackedSlugs, previous);

          Object.entries(data).forEach(([slug, value]) => {
            const count = Number(value);
            next[slug] = Number.isFinite(count) ? count : 0;
          });

          return next;
        });
        setLoading(false);
      }).catch(() => { if (isMounted) setLoading(false); });

    return () => {
      isMounted = false;
    };
  }, [trackedSlugs]);

  const recordDownload = useCallback(
    async (slug: string) => {
      const normalizedSlug = normalizeSlug(slug);

      if (!trackedSlugSet.has(normalizedSlug) || !countsConfigured) {
        return;
      }

      setCounts((previous) => ({
        ...previous,
        [normalizedSlug]: (previous[normalizedSlug] ?? 0) + 1,
      }));

      let savedCount: number;
      try { savedCount = await incrementDownloadCount(normalizedSlug); }
      catch {
        console.warn('Unable to record work download.');
        setCounts((previous) => ({
          ...previous,
          [normalizedSlug]: Math.max((previous[normalizedSlug] ?? 1) - 1, 0),
        }));
        return;
      }

      if (Number.isFinite(savedCount)) {
        setCounts((previous) => ({
          ...previous,
          [normalizedSlug]: savedCount,
        }));
      }
    },
    [trackedSlugSet],
  );

  return {
    configured: countsConfigured,
    counts: visibleCounts,
    loading,
    recordDownload,
  };
}
