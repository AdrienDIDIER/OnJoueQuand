import { describe,expect,it } from "vitest";
import { performance } from "node:perf_hooks";
import { mkdirSync,writeFileSync } from "node:fs";
import { cpus } from "node:os";
import { addDays,instantISO,instantMillis,localInstant,localParts,quarterStarts } from "../../lib/time/paris";
import { findMatches,type MatchingInput,type MatchingMember } from "./domain";
const day="2026-10-26";
const at=(time:string)=>localInstant(day,time);
const range=(a:string,b:string)=>({starts_at:at(a),ends_at:at(b)});
const member=(id:string,a="20:00",b="22:00",favorite=false):MatchingMember=>({id,favorite,availability:[range(a,b)],busy:[]});
const input=(members:MatchingMember[],minimum=2,durationMinutes=60):MatchingInput=>({starts_at:at("20:00"),ends_at:at("23:00"),now:at("19:00"),minimum,durationMinutes,members});
describe("Créneaux communs exacts",()=>{
  it("n'additionne pas des joueurs successifs pendant une fenêtre",()=>{
    const data=input([member("a","20:00","21:00"),member("b","20:00","20:30"),member("c","20:30","21:00")]);
    expect(findMatches(data)).toEqual([]);
    expect(findMatches({...data,minimum:1})[0]?.memberIds).toEqual(["a"]);
  });
  it("fusionne les plages contiguës et normalise les doublons sans muter l'entrée",()=>{
    const a=member("a"); a.availability=[range("20:30","21:00"),range("20:00","20:30"),range("20:00","20:30")];
    const data=input([a,member("b","20:00","21:00")]); const before=JSON.stringify(data);
    expect(findMatches(data)).toEqual([{starts_at:at("20:00"),ends_at:at("21:00"),memberIds:["a","b"],favoriteCount:0}]);
    expect(JSON.stringify(data)).toBe(before);
  });
  it("retire les engagements et respecte les bornes semi-ouvertes",()=>{
    const a=member("a","20:00","23:00"); a.busy=[range("21:00","22:00")];
    expect(findMatches(input([a,member("b","20:00","23:00")])).map(c=>c.starts_at)).toEqual([at("20:00"),at("22:00")]);
  });
  it("ne comble ni les trous ni les non-réponses",()=>{
    const a=member("a"); a.availability=[range("20:00","20:30"),range("20:45","22:00")];
    expect(findMatches(input([a,member("b")]))[0]?.starts_at).toBe(at("20:45"));
    expect(findMatches(input([{...a,availability:[]},member("b")]))).toEqual([]);
  });
  it("classe d'abord l'effectif, puis les favoris, puis l'horaire et limite à dix",()=>{
    const data=input([member("a","20:00","21:00"),member("b","20:00","21:00"),member("c","21:00","22:00",true),member("d","21:00","22:00",true)]);
    expect(findMatches(data).map(c=>c.starts_at)).toEqual([at("21:00"),at("20:00")]);
    expect(findMatches({...data,members:[...data.members,member("e","20:00","21:00")]} )[0]?.starts_at).toBe(at("20:00"));
    const many=findMatches(input([member("a","20:00","23:00"),member("b","20:00","23:00")],2,15));
    expect(many).toHaveLength(10); expect(many[0]?.starts_at).toBe(at("20:00"));
  });
  it("respecte l'instant présent, la durée et les sélections impossibles",()=>{
    const data=input([member("a"),member("b")]);
    expect(findMatches({...data,now:instantISO(instantMillis(at("20:00"))+60_000)})[0]?.starts_at).toBe(at("20:15"));
    expect(findMatches({...data,now:at("20:00").replace("Z",".000001Z")})[0]?.starts_at).toBe(at("20:15"));
    expect(findMatches({...data,now:at("23:00")})).toEqual([]);
    expect(findMatches({...data,minimum:3})).toEqual([]);
    expect(findMatches({...data,durationMinutes:240})).toEqual([]);
    expect(()=>findMatches({...data,durationMinutes:17})).toThrow();
    expect(()=>findMatches({...data,members:[data.members[0]!,data.members[0]!]})).toThrow();
  });
  it("énumère les deux occurrences d'automne et saute l'heure de printemps",()=>{
    const autumn=quarterStarts(localInstant("2026-10-25","00:00"),localInstant("2026-10-25","05:00"));
    expect(autumn).toHaveLength(24);
    expect(autumn.filter(ms=>localParts(instantISO(ms)).time==="02:30")).toHaveLength(2);
    const spring=quarterStarts(localInstant("2026-03-29","00:00"),localInstant("2026-03-29","05:00"));
    expect(spring).toHaveLength(16); expect(spring.some(ms=>localParts(instantISO(ms)).time.startsWith("02:"))).toBe(false);
  });
  it("mesure la durée réelle à travers l'heure répétée",()=>{
    const a=localInstant("2026-10-25","02:00","earlier"), b=localInstant("2026-10-25","03:00");
    const start=localInstant("2026-10-25","02:30","earlier");
    const results=findMatches({starts_at:a,ends_at:b,now:start,minimum:1,durationMinutes:60,members:[{id:"a",favorite:false,busy:[],availability:[{starts_at:a,ends_at:b}]}]});
    expect(results[0]?.ends_at).toBe(localInstant("2026-10-25","02:30","later"));
  });
  it("concorde avec un oracle indépendant de petites grilles",()=>{
    let seed=17; const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32;};
    const base=instantMillis(at("20:00")); const step=15*60_000;
    for(let sample=0;sample<40;sample++) {
      const matrix=Array.from({length:5},()=>Array.from({length:8},()=>({free:random()>.35,busy:random()>.8})));
      const members:MatchingMember[]=matrix.map((slots,i)=>({id:String(i),favorite:i%2===0,availability:slots.flatMap((v,j)=>v.free?[{starts_at:instantISO(base+j*step),ends_at:instantISO(base+(j+1)*step)}]:[]),busy:slots.flatMap((v,j)=>v.busy?[{starts_at:instantISO(base+j*step),ends_at:instantISO(base+(j+1)*step)}]:[])}));
      const expected=[];
      for(let tick=0;tick<=6;tick++) {
        const ids=matrix.flatMap((slots,i)=>slots.slice(tick,tick+2).every(v=>v.free&&!v.busy)?[String(i)]:[]);
        if(ids.length>=2) expected.push({starts_at:instantISO(base+tick*step),ends_at:instantISO(base+(tick+2)*step),memberIds:ids,favoriteCount:ids.filter(id=>Number(id)%2===0).length});
      }
      expected.sort((a,b)=>b.memberIds.length-a.memberIds.length||b.favoriteCount-a.favoriteCount||a.starts_at.localeCompare(b.starts_at));
      expect(findMatches({...input(members,2,30),ends_at:at("22:00")})).toEqual(expected.slice(0,10));
    }
  });
  it("reste sous 100 ms au p95 pour quinze membres sur quatre semaines",()=>{
    const members:MatchingMember[]=Array.from({length:15},(_,i)=>({id:String(i),favorite:i%3===0,busy:[],availability:Array.from({length:28},(_,d)=>({starts_at:localInstant(addDays(day,d),`${String(16+i%5).padStart(2,"0")}:00`),ends_at:localInstant(addDays(day,d),"23:00")}))}));
    const data={...input(members),starts_at:localInstant(day,"00:00"),ends_at:localInstant(addDays(day,28),"00:00")};
    for(let i=0;i<5;i++) findMatches(data);
    const measurements=Array.from({length:30},()=>{const start=performance.now();findMatches(data);return performance.now()-start;}).sort((a,b)=>a-b);
    const p95=measurements[Math.ceil(measurements.length*.95)-1]!;
    mkdirSync(".tools",{recursive:true});
    writeFileSync(".tools/j4-benchmark.json",JSON.stringify({p95Milliseconds:p95,node:process.version,platform:process.platform,architecture:process.arch,processor:cpus()[0]?.model,members:15,days:28,intervals:420,samples:30,warmups:5},null,2));
    console.info(`Matching J4 : p95=${p95.toFixed(2)} ms ; Node ${process.version} ; ${process.platform}/${process.arch} ; 15 membres, 28 jours, 420 intervalles, 30 mesures après 5 échauffements.`);
    expect(p95).toBeLessThan(100);
  });
});
