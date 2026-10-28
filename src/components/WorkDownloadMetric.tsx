import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWorkDownloads } from '../hooks/useWorkDownloads';

const copy={
  zh:{label:'下载数',loading:'加载中…',missing:'暂无记录',error:'暂不可用'},
  en:{label:'Downloads',loading:'Loading…',missing:'No records',error:'Unavailable'},
  ja:{label:'ダウンロード数',loading:'読込中…',missing:'記録なし',error:'取得不可'},
};

export function WorkDownloadMetric({slug,detail=false}:{slug:string;detail?:boolean}) {
  const {i18n}=useTranslation();
  const language=i18n.resolvedLanguage??i18n.language;
  const text=copy[language.startsWith('ja')?'ja':language.startsWith('en')?'en':'zh'];
  const state=useWorkDownloads();
  const count=state.data&&Object.hasOwn(state.data.works,slug)?state.data.works[slug].downloadClicks:null;
  if(state.status==='ready'&&count===0)return null;
  const value=state.status==='error'?text.error:state.status!=='ready'?text.loading:count===null?text.missing:new Intl.NumberFormat(language).format(count);
  return <div className="work-download-metric">
    <dl className={detail?'space-y-2':'space-y-1'}>
      <dt className="inline-flex items-center gap-2 text-gray-600 dark:text-content-muted"><Download size={detail?15:13} aria-hidden/>{text.label}</dt>
      <dd className={detail?'text-2xl font-semibold font-mono tabular-nums':'font-mono tabular-nums text-obsidian dark:text-content'}>{value}</dd>
    </dl>
  </div>;
}
