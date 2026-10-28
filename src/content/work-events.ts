export type WorkEventDay = { date:string; works:Record<string,{views:number;downloadClicks:number}> };
export const workEventKey=(date:string)=>`metrics/works/${date}.json`;

/** The Admin's selectable reports include today and use UTC calendar days. */
export function workEventWindow(days: 1 | 7 | 30, now = new Date()) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  return { from: start.toISOString(), to: end.toISOString(), timeZone: 'UTC' as const };
}

export function sumWorkEvents(events: readonly {slug:string;views:number;downloadClicks:number}[]) {
  const totals = new Map<string, {views:number;downloadClicks:number}>();
  for (const event of events) {
    const previous = totals.get(event.slug) ?? {views:0,downloadClicks:0};
    totals.set(event.slug, {views:previous.views+event.views,downloadClicks:previous.downloadClicks+event.downloadClicks});
  }
  return totals;
}

export type PublicWorkDownloads = {
  generatedAt: string;
  scope: 'all-time';
  revision: string;
  segment: { objects:number; records:number; complete:boolean; nextCursor?:string };
  // Each response is one bounded history segment, never a silently truncated total.
  // Null means no events for this work in this segment; zero is a recorded zero.
  works: Record<string, {downloadClicks:number|null}>;
};
export type PublicWorkDownloadTotals = Pick<PublicWorkDownloads,'generatedAt'|'scope'|'revision'|'works'>;
