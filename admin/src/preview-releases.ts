import type {Work} from '../shared/model';
import type {DownloadRelease} from '../../src/content/releases';

export function previewReleases(work:Work):DownloadRelease[]{
  return work.versions.filter(r=>r.status==='released').map(r=>({...r,status:'released',files:r.files.map(f=>({...f,publicUrl:f.publicUrl??new URL(`/api/files/${f.id}`,location.origin).href}))}));
}
