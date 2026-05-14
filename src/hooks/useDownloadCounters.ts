import { useCallback, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

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
  const [loading, setLoading] = useState(isSupabaseConfigured && trackedSlugs.length > 0);
  const visibleCounts = useMemo(() => countsForSlugs(trackedSlugs, counts), [counts, trackedSlugs]);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured || !supabase || trackedSlugs.length === 0) {
      return () => {
        isMounted = false;
      };
    }

    supabase
      .from('work_downloads')
      .select('slug, download_count')
      .in('slug', trackedSlugs)
      .then(({ data, error }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          console.warn('Unable to load work download counters:', error.message);
          setLoading(false);
          return;
        }

        setCounts((previous) => {
          const next = countsForSlugs(trackedSlugs, previous);

          data?.forEach((row) => {
            const count = Number(row.download_count);
            next[row.slug] = Number.isFinite(count) ? count : 0;
          });

          return next;
        });
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [trackedSlugs]);

  const recordDownload = useCallback(
    async (slug: string) => {
      const normalizedSlug = normalizeSlug(slug);

      if (!trackedSlugSet.has(normalizedSlug) || !isSupabaseConfigured || !supabase) {
        return;
      }

      setCounts((previous) => ({
        ...previous,
        [normalizedSlug]: (previous[normalizedSlug] ?? 0) + 1,
      }));

      const { data, error } = await supabase.rpc('increment_work_download', {
        p_slug: normalizedSlug,
      });

      if (error) {
        console.warn('Unable to record work download:', error.message);
        setCounts((previous) => ({
          ...previous,
          [normalizedSlug]: Math.max((previous[normalizedSlug] ?? 1) - 1, 0),
        }));
        return;
      }

      const savedCount = Number(data);
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
    configured: isSupabaseConfigured,
    counts: visibleCounts,
    loading,
    recordDownload,
  };
}
