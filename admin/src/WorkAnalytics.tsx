import { useMemo, useState } from 'react';
import type { MetricsFeed } from '../shared/analytics';
import { fileSize } from '../../src/content/releases';
import { sumWorkEvents } from '../../src/content/work-events';
export function WorkAnalytics({data,names}:{data:MetricsFeed;names:Record<string,string>}) {
  const [selected,setSelected]=useState('');
  const rows=useMemo(()=>{
    const map=new Map<string,{slug:string;views:number;clicks:number;requests:number;bytes:number;eventsAvailable:boolean}>();
    const row=(slug:string)=>{let value=map.get(slug);if(!value){value={slug,views:0,clicks:0,requests:0,bytes:0,eventsAvailable:false};map.set(slug,value);}return value;};
    for(const [slug,counts] of sumWorkEvents(data.workEvents??[])){const r=row(slug);r.views=counts.views;r.clicks=counts.downloadClicks;r.eventsAvailable=true;}
    for(const file of data.files){const r=row(file.slug);r.requests+=file.requests;r.bytes+=file.bytes;}
    return [...map.values()].filter(r=>!selected||r.slug===selected).sort((a,b)=>b.clicks-a.clicks||b.views-a.views||b.requests-a.requests);
  },[data,selected]);
  const exportCsv=()=>{
    const cell=(value:unknown)=>{let text=String(value);if(/^\s*[=+@-]|^[\t\r\n]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
    const csv='\ufeff'+[['作品','slug','详情浏览','下载点击','文件请求','文件响应字节'],...rows.map(r=>[names[r.slug]??r.slug,r.slug,r.eventsAvailable?r.views:'暂无记录',r.eventsAvailable?r.clicks:'暂无记录',r.requests,r.bytes])].map(line=>line.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fimel-work-statistics.csv';a.click();URL.revokeObjectURL(url);
  };
  return <section className="work-analytics"><h2>按作品汇总</h2><p className="hint">详情浏览与下载点击从新采集接口启用后累计，不回填历史数据。下载点击包括下载按钮及发布平台入口；官网“总下载数”使用同一采集源的全部历史累计，这里仍按所选日期范围显示，官网数据约每5分钟更新。文件请求来自 Cloudflare，包含分片、续传及机器人请求；三种口径分别展示，均不代表完整下载人数。</p>
    {!data.workEventsAvailable&&<p className="notice">当前范围尚无详情浏览／下载点击采集记录，暂显示“暂无记录”；已有文件请求统计仍可查看。</p>}
    {data.filesTruncated&&<p className="notice">Cloudflare 文件明细已达到条数上限，下表文件请求与流量可能不完整。</p>}
    <div className="report-controls"><label>统计作品<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">全部作品</option>{Object.entries(names).map(([slug,title])=><option key={slug} value={slug}>{title}</option>)}</select></label><button onClick={exportCsv}>导出作品统计 CSV</button></div>
    <div className="report-table"><table><thead><tr><th>作品</th><th>详情浏览</th><th>下载点击</th><th>文件请求</th><th>文件响应流量</th></tr></thead><tbody>{rows.map(r=><tr key={r.slug}><th>{names[r.slug]??r.slug}<small>{r.slug}</small></th><td>{r.eventsAvailable?r.views.toLocaleString():'暂无记录'}</td><td>{r.eventsAvailable?r.clicks.toLocaleString():'暂无记录'}</td><td>{r.requests.toLocaleString()}</td><td>{r.bytes?fileSize(r.bytes):'0 B'}</td></tr>)}</tbody></table></div>{!rows.length&&<p className="hint">此范围或筛选条件下暂无作品统计。</p>}
  </section>;
}
