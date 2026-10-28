// This is a transport/format checksum, not an authorization token. Every resumed
// request still reads only the fixed public metrics prefix under the current manifest.
export const HISTORY_CURSOR_PATTERN=/^v1\.[a-zA-Z0-9_-]{1,2732}\.[a-f0-9]{64}$/;
const rawPattern=/^[ -~]{1,2048}$/;
const body=(raw:string)=>btoa(raw).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
async function checksum(raw:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(byte=>byte.toString(16).padStart(2,'0')).join('');}
export async function encodeHistoryCursor(raw:string) {
  if(!rawPattern.test(raw))throw Error('Unsupported history cursor.');
  return `v1.${body(raw)}.${await checksum(raw)}`;
}
export async function decodeHistoryCursor(encoded:string) {
  if(!HISTORY_CURSOR_PATTERN.test(encoded))return undefined;
  const [,payload,digest]=encoded.split('.');
  let raw:string;
  try{raw=atob(payload.replaceAll('-','+').replaceAll('_','/'));}catch{return undefined;}
  if(!rawPattern.test(raw)||body(raw)!==payload||await checksum(raw)!==digest)return undefined;
  return raw;
}
