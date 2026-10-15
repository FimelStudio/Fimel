import type { Work, Release } from '../shared/model';
import { CommaInput } from './CommaInput';
export function ReleaseCompatibilityFields({work,release,update}:{work:Work;release:Release;update(work:Work):void}) {
  const field=(key:'gameVersions'|'loaders'|'platforms',values:string[])=>update({...work,versions:work.versions.map(r=>r.id===release.id?{...r,[key]:values}:r)});
  return <div className="form-grid release-compatibility"><label>适用游戏版本<CommaInput values={release.gameVersions} onChange={values=>field('gameVersions',values)} placeholder="例如 1.21.1, 1.21.4"/></label><label>加载器（可留空，逗号分隔）<CommaInput values={release.loaders??[]} onChange={values=>field('loaders',values)} placeholder="例如 Fabric, Forge"/></label><label>本版本运行平台（留空沿用作品平台）<CommaInput values={release.platforms??[]} onChange={values=>field('platforms',values)} placeholder="例如 Windows x64"/></label></div>;
}
