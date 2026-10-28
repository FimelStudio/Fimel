import type { Asset, Work, Locale } from '../shared/model';
import type { ProjectTab } from '../../src/content/projects';
import { imageUsage } from '../shared/image-usage';
export function ImageUsage({ work, asset, locate }: { work: Work; asset: Asset; locate(tab: ProjectTab, locale: Locale): void }) {
  const usages=imageUsage(work,asset);const labels={description:'详情',changelog:'更新日志',versions:'版本说明'};
  return <div className="image-usage"><small>{[work.coverId===asset.id?'当前封面':'',work.featuredCoverId===asset.id?'当前精选封图':'',usages.length?'正文使用中':''].filter(Boolean).join(' · ')||'未使用 · 保留在私有候选库'}</small>{usages.map(u=><button key={`${u.tab}-${u.locale}`} onClick={()=>locate(u.tab,u.locale)}>{labels[u.tab]} · {u.locale} ↗</button>)}<small>移除关联不会删除历史文件；正文使用中的图片请先定位并删除正文引用。</small></div>;
}
