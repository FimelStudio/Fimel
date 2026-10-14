import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { metrics } from '../admin/worker/analytics';

// Secrets arrive through stdin. Stage a Worker version without activating traffic.
let input='';
for await(const bytes of process.stdin){input+=bytes;if(input.length>16_384)throw new Error('输入超过限制。');}
let token='';
try {
  const value=JSON.parse(input) as {token?:string};input='';
  token=value.token?.trim()??'';delete value.token;
  if(!/^[A-Za-z0-9_.-]{20,4096}$/.test(token))throw new Error('分析 Token 格式不正确。');
  const configPath=resolve('.artifacts/admin-deploy.json');
  const target=JSON.parse(await readFile(configPath,'utf8'));
  if(target.name!=='fimel-admin'||target.account_id!=='13d3ede85821bfcfb2ed2f452d64c8da'||target.workers_dev!==false||target.preview_urls!==false)throw new Error('后台目标配置未就绪，未设置任何 Secret。');
  const zone='f844b9e938d147b935b6d5d9f82e4eef';
  const checked=await metrics(new Request('https://admin.studiofimel.com/api/analytics?days=1'),{CF_ANALYTICS_TOKEN:token,CF_ANALYTICS_ZONE:zone});
  console.log(`只读查询验证成功：${checked.domains.length} 组域名数据。正在暂存后台 Secret 版本。`);
  const child=spawn(process.execPath,[resolve('node_modules/wrangler/bin/wrangler.js'),'versions','secret','bulk','--config',configPath,'--message','Stage studiofimel.com read-only analytics credentials'],{cwd:resolve('.'),stdio:['pipe','pipe','pipe'],windowsHide:true});
  let output='';child.stdout.on('data',bytes=>{output+=bytes;});child.stderr.on('data',bytes=>{output+=bytes;});
  const completed=new Promise<number|null>((done,reject)=>{child.on('error',reject);child.on('close',done);});
  child.stdin.end(JSON.stringify({CF_ANALYTICS_TOKEN:token,CF_ANALYTICS_ZONE:zone}));
  const status=await completed;
  const sanitized=output.replaceAll(token,'[REDACTED]');
  if(status!==0)throw new Error('后台 Secret 版本暂存失败。请核对 Wrangler 登录与脚本权限；未主动发布版本。');
  console.log(sanitized);console.log('Secret 版本已暂存，未激活线上流量。只需把版本 ID 告知 Codex，不要发送 Token。');
}catch(error){console.error(error instanceof Error?error.message.replaceAll(token||'\u0000','[REDACTED]'):'分析配置失败，未确认完成。');process.exitCode=1;}
finally{
  // Drop module references after the one-shot setup; this does not promise memory zeroing.
  // eslint-disable-next-line no-useless-assignment
  token='';
  // eslint-disable-next-line no-useless-assignment
  input='';
}
