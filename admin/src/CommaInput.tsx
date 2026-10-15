import {useState} from 'react';
/** Preserve the in-progress separator while keeping the parent draft recoverable. */
export function CommaInput({values,onChange,placeholder}:{values:string[];onChange(values:string[]):void;placeholder?:string}) {
  const canonical=values.join(', ');const [draft,setDraft]=useState({source:canonical,raw:canonical});
  if(draft.source!==canonical)setDraft({source:canonical,raw:canonical});
  return <input value={draft.raw} placeholder={placeholder} onChange={event=>{const raw=event.target.value;const next=raw.split(',').map(v=>v.trim()).filter(Boolean);setDraft({source:next.join(', '),raw});onChange(next);}} onBlur={()=>setDraft({source:canonical,raw:canonical})}/>;
}
