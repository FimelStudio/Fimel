import { useEffect, useState } from 'react';
import type { Library, PublicManifest } from '../shared/model';
import { publicationFingerprint } from '../shared/revisions';
export function usePublicationStatus(library: Library, published: PublicManifest | null) {
  const [status, setStatus] = useState<Record<string, 'synced' | 'pending' | 'unknown'>>({});
  useEffect(() => {
    let active = true;
    void Promise.all(library.works.map(async work => {
      const previous = published?.publicationStates?.[work.project.slug];
      return [work.project.slug, previous ? await publicationFingerprint(work) === previous.fingerprint ? 'synced' : 'pending' : 'unknown'] as const;
    })).then(items => { if (active) setStatus(Object.fromEntries(items)); });
    return () => { active = false; };
  }, [library, published]);
  return status;
}
