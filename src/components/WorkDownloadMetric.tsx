import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkDownloads } from '../hooks/useWorkDownloads';

const copy={
  zh:{label:'总下载数',loading:'加载中…',missing:'暂无记录',error:'暂不可用',description:'从官网统计启用以来，下载按钮与发布平台入口点击的累计总数，与 Admin 使用同一采集源。数据约每5分钟更新；不代表完整下载人数，历史商店下载量另列。'},
  en:{label:'Total downloads',loading:'Loading…',missing:'No records',error:'Unavailable',description:'All-time clicks on download buttons and distribution links since website tracking began, using the same collection source as Admin. Figures update about every 5 minutes. Not completed downloads; historical store totals are listed separately.'},
  ja:{label:'総ダウンロード数',loading:'読込中…',missing:'記録なし',error:'取得不可',description:'公式サイトの統計開始以来のダウンロードボタンと配信先リンクの累計クリック数です。Admin と同じ収集元を使用し、約5分ごとに更新されます。完了したダウンロード人数ではなく、過去のストア累計は別途表示します。'},
};

export function WorkDownloadMetric({slug,detail=false}:{slug:string;detail?:boolean}) {
  const {i18n}=useTranslation();
  const language=i18n.resolvedLanguage??i18n.language;
  const text=copy[language.startsWith('ja')?'ja':language.startsWith('en')?'en':'zh'];
  const state=useWorkDownloads();
  const count=state.data&&Object.hasOwn(state.data.works,slug)?state.data.works[slug].downloadClicks:null;
  const value=state.status==='error'?text.error:state.status!=='ready'?text.loading:count===null?text.missing:new Intl.NumberFormat(language).format(count);
  return <div className="work-download-metric" title={text.description}>
    <dl className={detail?'space-y-2':'space-y-1'}>
      <dt className="inline-flex items-center gap-2 text-gray-600 dark:text-content-muted"><Download size={detail?15:13} aria-hidden/>{text.label}</dt>
      <dd className={detail?'text-2xl font-semibold font-mono tabular-nums':'font-mono tabular-nums text-obsidian dark:text-content'}>{value}</dd>
    </dl>
    {detail&&<p className="mt-3 text-[11px] leading-relaxed text-gray-600 dark:text-content-muted">{text.description}</p>}
  </div>;
}
