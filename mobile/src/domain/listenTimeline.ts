import type { Line } from './lines';
import { runStarts, type Run } from './run';

export type ListenChapter = { slide: number; runStart: number; durationMs: number };
export type ListenVisit = ListenChapter & { attemptId: string; startMs: number; endMs: number };

/** One take follows its source clock; composed takes retain the selected slide order. */
export function listenTimeline(run: Pick<Run, 'parts'> | null, times: readonly number[], sourceLines: readonly Line[]) {
  const starts = runStarts(times), visits: ListenVisit[] = [];
  run?.parts.forEach((part, slide) => {
    if (!part) return;
    let beforeMs = 0;
    for (const segment of part.segments) {
      const durationMs = segment.endMs - segment.startMs;
      if (durationMs <= 0) continue;
      visits.push({ ...segment, attemptId: part.attemptId, slide, durationMs, runStart: (starts[slide] ?? 0) + beforeMs / 1000 });
      beforeMs += durationMs;
    }
  });
  const chronological = new Set(visits.map(visit => visit.attemptId)).size === 1;
  let total = times.reduce((sum, seconds) => sum + seconds, 0);
  let lines = [...sourceLines];
  if (chronological) {
    visits.sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
    let elapsedMs = 0;
    for (const visit of visits) { visit.runStart = elapsedMs / 1000; elapsedMs += visit.durationMs; }
    total = elapsedMs / 1000;
    lines = sourceLines.flatMap(line => {
      const visit = visits.find(item => item.attemptId === line.audio.attemptId &&
        line.audio.startMs >= item.startMs && line.audio.startMs < item.endMs);
      return visit ? [{ ...line, slide: visit.slide, t: visit.runStart + (line.audio.startMs - visit.startMs) / 1000 }] : [];
    }).sort((a, b) => a.t - b.t);
  }
  const chapters: ListenChapter[] = chronological ? visits : times.map((seconds, slide) => ({
    slide, runStart: starts[slide], durationMs: seconds * 1000,
  }));
  return { chronological, visits, chapters, lines, total };
}

/** A boundary belongs to the following selected interval; unselected audio gaps have no entry. */
export function listenEntryAt<T extends ListenChapter>(seconds: number, entries: readonly T[]): T | undefined {
  const found = entries.find(entry => seconds >= entry.runStart && seconds < entry.runStart + entry.durationMs / 1000);
  if (found) return found;
  const last = entries.findLast(entry => entry.durationMs > 0);
  return last && Math.abs(seconds - last.runStart - last.durationMs / 1000) < 0.000001 ? last : undefined;
}
