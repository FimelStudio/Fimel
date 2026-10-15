export function PublicationTimes({ savedAt, storedAt, published }: { savedAt: string; storedAt?:string; published?: { publishedAt: string; savedAt: string } }) {
  const date=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'});
  return <div className="publication-times"><small>当前编辑时间：{date(savedAt)}</small><small>最近保存：{storedAt?date(storedAt):'尚未保存'}</small>{published?<><small>最近发布：{date(published.publishedAt)}</small><small>线上采用的草稿保存时间：{date(published.savedAt)}</small></>:<small>历史作品尚无发布对照记录，核对后正常发布即可建立；不会自动重发。</small>}</div>;
}
