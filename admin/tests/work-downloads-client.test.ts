import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readWorkDownloadTotals} from '../../src/lib/work-downloads';
import type {PublicWorkDownloads} from '../../src/content/work-events';
import {encodeHistoryCursor} from '../../src/lib/work-download-cursor';

const segment=(count:number|null,complete:boolean,cursor?:string):PublicWorkDownloads=>({
  generatedAt:'2026-10-28T12:00:00.000Z',scope:'all-time',revision:'public-revision-1',
  segment:{objects:200,records:200,complete,...(cursor?{nextCursor:cursor}:{})},
  works:{work:{downloadClicks:count},untracked:{downloadClicks:null},zero:{downloadClicks:0}},
});

test('累计读取器完成所有历史段才返回总数，携带相同revision，零和暂无记录独立保留',async()=>{
  const calls:string[]=[];
  const cursor=await encodeHistoryCursor('next-page');
  const result=await readWorkDownloadTotals('/api/work-downloads',async(input,init)=>{
    calls.push(String(input));assert.equal(init?.credentials,'omit');assert.equal(init?.cache,'no-store');
    return Response.json(calls.length===1?segment(5,false,cursor):segment(999,true));
  });
  assert.deepEqual(calls,['/api/work-downloads',`/api/work-downloads?cursor=${cursor}&revision=public-revision-1`]);
  assert.deepEqual(result.works,{work:{downloadClicks:1004},untracked:{downloadClicks:null},zero:{downloadClicks:0}});
});

test('后续段失败、目录revision变化或成员变化时拒绝整个累计，不交付第一段数字',async()=>{
  for(const failure of ['http','revision','membership']as const){
    let calls=0;
    await assert.rejects(readWorkDownloadTotals('/api/work-downloads',async()=>{
      if(++calls===1)return Response.json(segment(123,false,await encodeHistoryCursor('next-page')));
      if(failure==='http')return Response.json({error:'unavailable'},{status:503});
      const data=segment(456,true);if(failure==='revision')data.revision='public-revision-2';else delete data.works.work;
      return Response.json(data);
    }));
    assert.equal(calls,2);
  }
});

test('重复cursor、负数和安全整数溢出都拒绝返回伪造总数',async()=>{
  for(const failure of ['cursor','negative','overflow']as const){
    let calls=0;
    await assert.rejects(readWorkDownloadTotals('/api/work-downloads',async()=>{
      calls++;
      return Response.json(failure==='cursor'?segment(1,false,await encodeHistoryCursor('repeat-cursor')):failure==='negative'?segment(-1,true):calls===1?segment(Number.MAX_SAFE_INTEGER,false,await encodeHistoryCursor('next-page')):segment(1,true));
    }));
    assert.ok(calls<=2);
  }
});

test('多于200段或40000个对象时明确失败，不静默截断为部分历史总数',async()=>{
  let calls=0;
  await assert.rejects(readWorkDownloadTotals('/api/work-downloads',async()=>Response.json(segment(1,false,await encodeHistoryCursor(`page-${++calls}`)))),/safe aggregation limit/);
  assert.equal(calls,200);
});
