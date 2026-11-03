export type DocumentationBlock =
  | { kind: 'markdown'; content: string; line: number }
  | { kind: 'split'; side: 'left' | 'right'; image: string; imageLine: number; content: string; line: number };
export type DocumentationHeading = { id: string; text: string; depth: number; line: number };

function fenceStart(line: string) {
  const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  if (!match || match[1][0] === '`' && match[2].includes('`')) return null;
  return { character: match[1][0], length: match[1].length };
}
function fenceEnd(line: string, fence: { character: string; length: number }) {
  const match = /^ {0,3}(`+|~+)\s*$/.exec(line);
  return !!match && match[1][0] === fence.character && match[1].length >= fence.length;
}

/** Explicit Markdown containers; markers in fenced code are always literal. */
export function documentationBlocks(source: string): DocumentationBlock[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const output: DocumentationBlock[] = [];
  let buffer: string[] = [], bufferLine = 1;
  let fence: ReturnType<typeof fenceStart> = null;
  let container: { side: 'left' | 'right'; start: number; lines: string[] } | null = null;
  function flush() { if (buffer.length) output.push({ kind: 'markdown', content: buffer.join('\n'), line: bufferLine }); buffer = []; }
  function append(line: string, index: number) { if (container) container.lines.push(line); else { if (!buffer.length) bufferLine = index + 1; buffer.push(line); } }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (fence) { append(line, index); if (fenceEnd(line, fence)) fence = null; continue; }
    const nextFence = fenceStart(line);
    if (nextFence) { fence = nextFence; append(line, index); continue; }
    const start = /^ {0,3}:::image-(left|right)\s*$/.exec(line);
    if (!container && start) { flush(); container = { side: start[1] as 'left' | 'right', start: index, lines: [] }; continue; }
    if (container && /^ {0,3}:::\s*$/.test(line)) {
      const inner = container.lines;
      let first = 0; while (first < inner.length && !inner[first].trim()) first++;
      let end = first; while (end < inner.length && inner[end].trim()) end++;
      const imageLines = inner.slice(first, end);
      if (imageLines.length && imageLines.every(value => /^!\[(?:[^\]\\]|\\.)*\]\([^\r\n]+\)\s*$/.test(value.trim())) && inner.slice(end).some(value => value.trim())) {
        output.push({ kind: 'split', side: container.side, image: imageLines.join('\n'), imageLine: container.start + first + 2, content: inner.slice(end).join('\n'), line: container.start + end + 2 });
      } else {
        output.push({ kind: 'markdown', content: [lines[container.start], ...inner, line].join('\n'), line: container.start + 1 });
      }
      container = null; continue;
    }
    append(line, index);
  }
  if (container) { bufferLine = container.start + 1; buffer = [lines[container.start], ...container.lines]; }
  flush(); return output;
}

export function plainHeading(value: string) {
  return value.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*_`~]/g, '').replace(/\\([\\`*{}[\]()#+\-.!_>])/g, '$1').trim();
}
export function documentationHeadings(source: string): DocumentationHeading[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const counts = new Map<string, number>(); const used = new Set<string>(); const result: DocumentationHeading[] = [];
  let fence: ReturnType<typeof fenceStart> = null;
  for (const [index, line] of lines.entries()) {
    if (fence) { if (fenceEnd(line, fence)) fence = null; continue; }
    const next = fenceStart(line); if (next) { fence = next; continue; }
    const heading = /^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line); if (!heading) continue;
    const text = plainHeading(heading[2]);
    const base = text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-') || 'section';
    let count = (counts.get(base) ?? 0) + 1;
    let id = count === 1 ? base : `${base}-${count}`;
    while (used.has(id)) { count++; id = `${base}-${count}`; }
    counts.set(base, count); used.add(id);
    result.push({ id, text, depth: heading[1].length, line: index + 1 });
  }
  return result;
}
