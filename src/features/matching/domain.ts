import { compareInstant,instantISO, instantMillis, quarterStarts } from "../../lib/time/paris";

export type TimeRange = { starts_at: string; ends_at: string };
export type MatchingMember = { id: string; availability: TimeRange[]; busy: TimeRange[]; favorite: boolean };
export type MatchingInput = { starts_at: string; ends_at: string; now: string; minimum: number; durationMinutes: number; members: MatchingMember[] };
export type Candidate = TimeRange & { memberIds: string[]; favoriteCount: number };
type Span = { start: number; end: number };
function union(ranges: Span[]): Span[] {
  const result: Span[] = [];
  for (const r of [...ranges].sort((a,b) => a.start-b.start)) {
    if (r.start >= r.end) throw new Error("Intervalle invalide.");
    const last = result.at(-1);
    if (last && r.start <= last.end) last.end = Math.max(last.end,r.end);
    else result.push({ ...r });
  }
  return result;
}
function subtract(available: Span[], busy: Span[]): Span[] {
  const result: Span[] = [];
  for (const a of available) {
    let cursor = a.start;
    for (const b of busy) {
      if (b.end <= cursor) continue;
      if (b.start >= a.end) break;
      if (b.start > cursor) result.push({ start: cursor, end: b.start });
      cursor = Math.max(cursor,b.end);
      if (cursor >= a.end) break;
    }
    if (cursor < a.end) result.push({ start: cursor, end: a.end });
  }
  return result;
}
export function findMatches(input: MatchingInput): Candidate[] {
  const start = instantMillis(input.starts_at), end = instantMillis(input.ends_at);
  const now = instantMillis(input.now); const duration = input.durationMinutes * 60_000;
  if (!(start < end) || end-start > 29*86400_000 || !Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0 || input.durationMinutes % 15 || !Number.isInteger(input.minimum) || input.minimum < 1) throw new Error("Vérifiez la période, la durée et le nombre de joueurs.");
  if (new Set(input.members.map(m=>m.id)).size !== input.members.length) throw new Error("Sélection de membres invalide.");
  if (input.minimum > input.members.length || duration > end-start || now >= end) return [];
  const events: { at:number; id:string; entering:boolean }[] = [];
  const numeric = (r:TimeRange):Span => ({ start:instantMillis(r.starts_at), end:instantMillis(r.ends_at) });
  for (const m of input.members) {
    const free = subtract(union(m.availability.map(numeric)),union(m.busy.map(numeric)));
    for (const s of free) {
      const a=Math.max(s.start,start), b=Math.min(s.end,end);
      if(a<b) events.push({at:a,id:m.id,entering:true},{at:b,id:m.id,entering:false});
    }
  }
  events.sort((a,b)=>a.at-b.at || Number(a.entering)-Number(b.entering));
  const segments: (Span & { ids:Set<string> })[] = []; const active = new Set<string>();
  for(let i=0;i<events.length;) {
    const at=events[i]!.at;
    while(i<events.length && events[i]!.at===at) { const e=events[i++]!; if(e.entering) active.add(e.id); else active.delete(e.id); }
    if(i<events.length) segments.push({start:at,end:events[i]!.at,ids:new Set(active)});
  }
  const favorites = new Set(input.members.filter(m=>m.favorite).map(m=>m.id));
  const candidates: { start:number; end:number; ids:string[]; favorites:number }[] = [];
  let index=0;
  const lower=compareInstant(input.starts_at,input.now)>=0 ? input.starts_at : input.now;
  for(const a of quarterStarts(lower,input.ends_at)) {
    const b=a+duration; if(b>end) break;
    while(index<segments.length && segments[index]!.end<=a) index++;
    let cursor=a; let ids:Set<string>|undefined;
    for(let j=index;j<segments.length && cursor<b;j++) {
      const s=segments[j]!;
      if(s.start>cursor) break;
      ids=ids ? new Set([...ids].filter(id=>s.ids.has(id))) : new Set(s.ids);
      if(ids.size<input.minimum) break;
      cursor=Math.min(b,s.end);
    }
    if(cursor===b && ids && ids.size>=input.minimum) {
      const sorted=[...ids].sort(); candidates.push({start:a,end:b,ids:sorted,favorites:sorted.filter(id=>favorites.has(id)).length});
    }
  }
  return candidates.sort((a,b)=>b.ids.length-a.ids.length || b.favorites-a.favorites || a.start-b.start).slice(0,10).map(c=>({ starts_at:instantISO(c.start), ends_at:instantISO(c.end), memberIds:c.ids, favoriteCount:c.favorites }));
}
