export type StorageRecovery = {
  id: string;
  startedAt: string;
  readyAt: string;
  writers: Record<string, string>;
  revisions: Record<string, string>;
  auditKey: string;
};
export type StorageGate = {
  writers: Record<string, string>;
  cleaner?: string;
  recovery?: StorageRecovery;
  recovered?: { id: string; time: string; auditKey: string };
};
export const RECOVERY_MIN_AGE = 24 * 60 * 60 * 1000;
export const RECOVERY_WAIT = 60 * 1000;
export function recoverableWriters(gate: StorageGate, now: number) {
  const times = Object.values(gate.writers);
  return !gate.cleaner && times.length > 0 && times.every(time => now - Date.parse(time) >= RECOVERY_MIN_AGE);
}
