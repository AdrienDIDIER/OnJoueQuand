"use client";
import { useActionState, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { addDays, dayLabel, intervalLabel, localParts, type Occurrence } from "@/lib/time/paris";
import type { Day, LocalRange } from "../domain";
import { applyAvailability, previewCopy, previewDay, type AvailabilityState } from "../actions";
import {useAvailabilityUpdates,useLiveDay} from "../client";
import type {QuickReplyResult} from "../quick-command";
import {usePrivateNavigation} from "@/features/navigation/client";
const initial: AvailabilityState = { message: "" };

function Confirmation({ state }: { state: AvailabilityState }) {
  const [saved, action, pending] = useActionState(applyAvailability, initial);
  return <div className="availability-preview" aria-live="polite">
    <p>{state.message}</p>
    {state.token && !saved.done && <><ul>{state.summary?.map((s) => <li key={s}>{s}</li>)}</ul>
      <form action={action}><input type="hidden" name="token" value={state.token} /><Button disabled={pending} aria-busy={pending}>Confirmer ces disponibilités</Button></form></>}
    <p role="status">{saved.message}</p>
  </div>;
}
function OccurrenceSelect({ label, value, onChange }: { label: string; value?: Occurrence; onChange: (v: Occurrence) => void }) {
  return <label>{label}<select value={value ?? ""} onChange={(e) => onChange((e.target.value || undefined) as Occurrence)}>
    <option value="">Heure habituelle</option><option value="earlier">Première occurrence</option><option value="later">Seconde occurrence</option>
  </select></label>;
}
function QuickReply({day,quick,memberId}:{day:Day;quick:{start:string;end:string};memberId:string}) {
  const {commit,memberId:owner}=useAvailabilityUpdates();
  const {accessKey}=usePrivateNavigation();
  const saving=useRef(false);
  const [pending,setPending]=useState(false),[message,setMessage]=useState("");
  const [optimistic,setOptimistic]=useState<Day["status"]|null>(null);
  const choice=optimistic??day.status;
  return <form onSubmit={async event=>{
    event.preventDefault();
    const submitter=(event.nativeEvent as SubmitEvent).submitter;
    const status=submitter instanceof HTMLButtonElement?submitter.value:undefined;
    if(saving.current||!(status==="available"||status==="unavailable"))return;
    if(owner!==memberId){window.location.reload();return;}
    saving.current=true;setPending(true);setMessage("");setOptimistic(status);
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20_000);
    try{
      const response=await fetch("/api/availability/quick",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","X-OJQ-Context":accessKey},body:JSON.stringify({date:day.local_date,revision:day.revision,status,quickStart:quick.start,quickEnd:quick.end}),signal:controller.signal});
      if(response.redirected){window.location.replace("/connexion");return;}
      const result=await response.json() as QuickReplyResult;
      if(result.code==="context_changed"){window.location.reload();return;}
      if(!response.ok||!result.done||!result.day){setMessage(result.message||"Réponse refusée. Actualisez puis réessayez.");return;}
      commit(result.day);
    }catch{setMessage("Enregistrement non confirmé. Actualisez avant de réessayer.");}
    finally{clearTimeout(timeout);saving.current=false;setOptimistic(null);setPending(false);}
  }} className="quick-reply" aria-busy={pending}><input type="hidden" name="date" value={day.local_date}/><input type="hidden" name="revision" value={day.revision??""}/><input type="hidden" name="quickStart" value={quick.start}/><input type="hidden" name="quickEnd" value={quick.end}/>
    <div><Button variant="outline" name="status" value="available" aria-label={`Dispo ${quick.start}–${quick.end}`} aria-pressed={choice==="available"} disabled={pending} aria-busy={pending}><Check size={16} aria-hidden="true"/>Dispo</Button><Button variant="outline" name="status" value="unavailable" aria-label="Indispo" aria-pressed={choice==="unavailable"} disabled={pending} aria-busy={pending}><X size={16} aria-hidden="true"/>Non</Button></div>
    {pending?<p className="sr-only" role="status">Enregistrement…</p>:message&&<p role="status">{message}</p>}
  </form>;
}
export function DayEditor({ day:initialDay, next:initialNext, editable, quick,memberId, isToday=false }: { day: Day; next: Day; editable: boolean; quick: { start: string; end: string };memberId:string; isToday?:boolean }) {
  const day=useLiveDay(initialDay,memberId),next=useLiveDay(initialNext,memberId);
  const summary=day.status==="unanswered"?"Sans réponse":day.status==="unavailable"?"Indisponible":day.mode==="detailed"?day.intervals.map(r=>intervalLabel(r.starts_at,r.ends_at,day.local_date)).join(" · "):"Disponible";
  return <div className={`day-editor${isToday?" day-today":""}`} role="group" aria-label={dayLabel(day.local_date)}>
    <Sheet title={`Horaires du ${dayLabel(day.local_date)}`} trigger={<><strong>{dayLabel(day.local_date).split(" ").slice(0,2).join(" ")}</strong><span>{summary}</span><span className="sr-only">{dayLabel(day.local_date)}</span></>}><DetailedDayEditor day={day} next={next} editable={editable} quick={quick}/></Sheet>
    {editable&&day.mode!=="detailed"&&<QuickReply day={day} quick={quick} memberId={memberId}/>}
  </div>;
}

function DetailedDayEditor({ day, next, editable, quick }: { day: Day; next: Day; editable: boolean; quick: { start: string; end: string } }) {
  const [status, setStatus] = useState<Day["status"]>(day.status);
  const [mode, setMode] = useState<"quick" | "detailed">(day.mode ?? "quick");
  const [ranges, setRanges] = useState<LocalRange[]>(day.intervals.length ? day.intervals.map((r) => {
    const start = localParts(r.starts_at); const end = localParts(r.ends_at);
    return { start: start.time, end: end.date > day.local_date ? "24:00" : end.time, startOccurrence: start.occurrence, endOccurrence: end.occurrence };
  }) : [{ start: "20:00", end: "23:00" }]);
  const [state, action, pending] = useActionState(previewDay, initial);
  const [dirty, setDirty] = useState(false);
  const setRange = (index: number, patch: Partial<LocalRange>) => { setDirty(true); setRanges(ranges.map((r, i) => i === index ? { ...r, ...patch } : r)); };
  return <div className="detailed-editor">
    {day.mode==="detailed"&&<p className="day-ranges">{day.intervals.map(r=>intervalLabel(r.starts_at,r.ends_at,day.local_date)).join(" · ")}</p>}
    <section className="day-options">
    {!editable ? <p>Cette semaine est consultable et copiable, mais ne peut plus être modifiée.</p> : <>
      <form action={(form) => { setDirty(false); action(form); }} className="form-stack availability-form" onChange={() => setDirty(true)}>
        <input type="hidden" name="date" value={day.local_date} />
        <input type="hidden" name="revisions" value={JSON.stringify([day, next].map(({ local_date, revision }) => ({ local_date, revision })))} />
        <input type="hidden" name="ranges" value={JSON.stringify(ranges)} />
        <label>Votre réponse<select name="status" value={status} onChange={(e) => setStatus(e.target.value as Day["status"])}>
          <option value="unanswered">Sans réponse</option><option value="unavailable">Indisponible</option><option value="available">Disponible</option>
        </select></label>
        <label hidden={status !== "available"}>Mode de saisie<select name="mode" value={mode} onChange={(e) => setMode(e.target.value as "quick" | "detailed")}>
          <option value="quick">Rapide · {quick.start}–{quick.end}</option><option value="detailed">Horaires détaillés</option>
        </select></label>
        {status === "available" && mode === "quick" && <p>Vous serez disponible de {quick.start} à {quick.end}, heure de Paris.</p>}
        {status === "available" && mode === "detailed" && <>
          <p>Pas de quinze minutes. Pour finir à minuit, saisir 24:00. Les heures répétées au changement d’heure nécessitent une occurrence.</p>
          {ranges.map((r, i) => <fieldset key={i} className="range-row"><legend>Intervalle {i + 1}</legend>
            <label>Début<input aria-label={`Début ${i + 1}`} type="time" step="900" value={r.start} required onChange={(e) => setRange(i, { start: e.target.value })} /></label>
            <label>Fin<input aria-label={`Fin ${i + 1}`} inputMode="numeric" pattern="([01][0-9]|2[0-3]):(00|15|30|45)|24:00" value={r.end} required placeholder="23:00" onChange={(e) => setRange(i, { end: e.target.value })} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={r.overnight ?? false} onChange={(e) => setRange(i, { overnight: e.target.checked })} />Fin le lendemain</label>
            <details className="secondary-details"><summary>Heure répétée au changement d’heure</summary><OccurrenceSelect label="Occurrence du début" value={r.startOccurrence} onChange={(v) => setRange(i, { startOccurrence: v })} />
            <OccurrenceSelect label="Occurrence de la fin" value={r.endOccurrence} onChange={(v) => setRange(i, { endOccurrence: v })} /></details>
            {ranges.length > 1 && <Button type="button" variant="outline" onClick={() => { setDirty(true); setRanges(ranges.filter((_, j) => j !== i)); }}>Retirer cet intervalle</Button>}
          </fieldset>)}
          <Button type="button" variant="outline" disabled={ranges.length >= 16} onClick={() => { setDirty(true); setRanges([...ranges, { start: "20:00", end: "23:00" }]); }}>Ajouter un intervalle</Button>
        </>}
        <Button disabled={pending} aria-busy={pending}>Prévisualiser cette journée</Button>
      </form>
      {!dirty && <Confirmation key={state.token ?? state.message} state={state} />}
    </>}
  </section></div>;
}

export function CopyEditor({ week, first, last }: { week: string; first: string; last: string }) {
  const [state, action, pending] = useActionState(previewCopy, initial);
  const [dirty, setDirty] = useState(false);
  const [choices, setChoices] = useState<Record<string, Occurrence>>({});
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const weeks: string[] = []; for (let w = first; w <= last; w = addDays(w, 7)) weeks.push(w);
  return <details className="group-card disclosure"><summary>Reprendre une semaine précédente</summary><section className="disclosure-body"><h2>Copier une semaine</h2><p>Les journées déjà renseignées sont conservées par défaut.</p>
    <form action={(form) => { setDirty(false); action(form); }} className="form-stack" onChange={() => setDirty(true)}>
      <input type="hidden" name="target" value={week} /><input type="hidden" name="occurrences" value={JSON.stringify(choices)} /><input type="hidden" name="corrections" value={JSON.stringify(corrections)} />
      <label>Semaine source<select name="source" defaultValue={addDays(week, -7)} onChange={() => { setChoices({}); setCorrections({}); }}>{weeks.filter((w) => w !== week).map((w) => <option key={w} value={w}>Semaine du {dayLabel(w)}</option>)}</select></label>
      <label className="checkbox-label"><input name="replace" type="checkbox" />Remplacer aussi mes journées déjà renseignées</label>
      {state.resolutions?.map((r) => r.kind === "occurrence" ? <OccurrenceSelect key={r.key} label={r.label} value={choices[r.key]} onChange={(value) => setChoices({ ...choices, [r.key]: value })} /> :
        <label key={r.key}>{r.label} · heure inexistante : choisir un autre horaire<input type="time" step="900" value={corrections[r.key] ?? ""} onChange={(e) => setCorrections({ ...corrections, [r.key]: e.target.value })} /></label>)}
      <Button disabled={pending} aria-busy={pending}>Prévisualiser la copie</Button>
    </form>
    {!dirty && <Confirmation key={state.token ?? state.message} state={state} />}
  </section></details>;
}
