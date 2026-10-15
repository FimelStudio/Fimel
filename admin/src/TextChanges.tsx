export function TextChanges({before,after}:{before:string;after:string}) {
  if(before===after)return <p className="hint">当前正文未改动。</p>;
  let start=0;while(start<before.length&&start<after.length&&before[start]===after[start])start++;
  let end=0;while(end<before.length-start&&end<after.length-start&&before[before.length-1-end]===after[after.length-1-end])end++;
  const old=before.slice(start,end?before.length-end:undefined),next=after.slice(start,end?after.length-end:undefined);
  return <details className="text-changes"><summary>查看当前语言／页签的正文差异</summary><p className="hint">红色为移除的内容，绿色为新增的内容；图片地址转换也可能产生文本差异。</p><div className="diff-columns"><section><h3>当前官网移除部分</h3><pre><del>{old||'（无）'}</del></pre></section><section><h3>草稿新增部分</h3><pre><ins>{next||'（无）'}</ins></pre></section></div></details>;
}
