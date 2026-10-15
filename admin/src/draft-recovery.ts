import type { Work } from '../shared/model';
export type Recovery = { key: string; at: string; selected: string | null; edits: { base: Work | null; work: Work }[] };
let memoryTabId:string|undefined;
export function browserTabId(){
  memoryTabId??=crypto.randomUUID();
  try{const saved=sessionStorage.getItem('fimel-admin-tab');if(saved&&/^[a-zA-Z0-9-]{1,80}$/.test(saved))return saved;sessionStorage.setItem('fimel-admin-tab',memoryTabId);}catch{/* The in-memory ID still isolates open tabs. */}
  return memoryTabId;
}
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('fimel-admin-recovery', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
export async function recoveryStore<T = Recovery | undefined>(key: string, action: 'get' | 'list' | 'put' | 'delete', value?: unknown): Promise<T> {
  const db = await database();
  try { return await new Promise<T>((resolve, reject) => {
    const transaction = db.transaction('drafts', action === 'get'||action==='list' ? 'readonly' : 'readwrite'); const store = transaction.objectStore('drafts');
    const request = action === 'list'?store.getAll():action === 'get' ? store.get(key) : action === 'delete' ? store.delete(key) : store.put(value!);
    let result: T; request.onsuccess = () => { result = request.result; };
    transaction.oncomplete = () => resolve(result); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error);
  }); } finally { db.close(); }
}
