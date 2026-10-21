import { describe,it,expect } from "vitest";
import { effectiveStatus,prepareEvening,prepareProposal,suggestedDeadline } from "./domain";
const now="2026-10-21T10:00:00Z";
describe("soirée à horaire unique",()=>{
  const input={title:"",gameId:"",day:"2026-10-22",start:"20:00",end:""};
  it("prévoit 23 h et un nom facultatif, sans vote",()=>{
    expect(prepareEvening(input,now)).toEqual({title:"Soirée entre potes",game_id:null,starts_at:"2026-10-22T18:00:00Z",ends_at:"2026-10-22T21:00:00Z"});
  });
  it("garde les heures locales après minuit et au changement d’heure",()=>{
    expect(prepareEvening({...input,day:"2026-10-24",start:"23:30",end:"03:00"},now).ends_at).toBe("2026-10-25T02:00:00Z");
    expect(()=>prepareEvening({...input,day:"2026-10-25",start:"02:15"},now)).toThrow("deux fois");
    expect(prepareEvening({...input,day:"2026-10-25",start:"02:15",startOccurrence:"later"},now).starts_at).toBe("2026-10-25T01:15:00Z");
    expect(()=>prepareEvening({...input,day:"2027-03-28",start:"02:15"},now)).toThrow("n’existe pas");
  });
  it("refuse une soirée passée et un horaire hors pas",()=>{
    expect(()=>prepareEvening({...input,day:"2026-10-20"},now)).toThrow("future");
    expect(()=>prepareEvening({...input,start:"20:07"},now)).toThrow("quinze");
  });
});
const proposal={title:" Soirée coop ",description:"",gameId:"",minimum:2,deadline:"",slots:[{start:"2026-10-22T20:00",end:"2026-10-22T23:00"},{start:"2026-10-23T20:00",end:"2026-10-23T23:00"}]};
describe("propositions et temps de Paris",()=>{
  it("convertit les heures locales et laisse le défaut de l’échéance à la base",()=>{
    const p=prepareProposal(proposal,now);expect(p.title).toBe("Soirée coop");expect(p.slots[0]?.starts_at).toBe("2026-10-22T18:00:00Z");expect(p.vote_deadline).toBeNull();
    expect(suggestedDeadline(p.slots,now)).toBe("2026-10-22T18:00:00Z");
    expect(suggestedDeadline([{starts_at:"2026-11-01T12:00:00Z"}],now)).toBe("2026-10-23T10:00:00Z");
  });
  it("refuse les doublons, créneaux passés, fins invalides et échéances tardives",()=>{
    expect(()=>prepareProposal({...proposal,slots:[proposal.slots[0],proposal.slots[0]]},now)).toThrow("distincts");
    expect(()=>prepareProposal(proposal,"2026-10-24T00:00:00Z")).toThrow("futurs");
    expect(()=>prepareProposal({...proposal,slots:[{start:"2026-10-22T23:00",end:"2026-10-22T20:00"},proposal.slots[1]]},now)).toThrow("fin");
    expect(()=>prepareProposal({...proposal,deadline:"2026-10-22T21:00"},now)).toThrow("échéance");
    expect(()=>prepareProposal({...proposal,slots:proposal.slots.slice(0,1)},now)).toThrow();
  });
  it("refuse le trou d’heure et exige l’occurrence d’automne, même pour l’échéance",()=>{
    expect(()=>prepareProposal({...proposal,slots:[{start:"2027-03-28T02:15",end:"2027-03-28T04:00"},proposal.slots[0]]},now)).toThrow("n’existe pas");
    const slots=[{start:"2026-10-25T02:15",end:"2026-10-25T03:15"},proposal.slots[0]];
    expect(()=>prepareProposal({...proposal,slots},now)).toThrow("deux fois");
    const p=prepareProposal({...proposal,slots:[{...slots[0],startOccurrence:"later"},proposal.slots[0]]},now);expect(p.slots[0]?.starts_at).toBe("2026-10-25T01:15:00Z");
    expect(()=>prepareProposal({...proposal,slots:[{start:"2026-10-26T20:00",end:"2026-10-26T23:00"}, {start:"2026-10-27T20:00",end:"2026-10-27T23:00"}],deadline:"2026-10-25T02:15"},now)).toThrow("deux fois");
  });
});
describe("états effectifs sans attendre le cron",()=>{
  const slots=[{id:"a",starts_at:"2026-10-22T18:00:00Z",ends_at:"2026-10-22T21:00:00Z"}];
  it("ferme à l’échéance exacte et expire quand aucun créneau ne peut commencer",()=>{
    expect(effectiveStatus("voting",now,slots,null,now)).toBe("closed");
    expect(effectiveStatus("voting",now,slots,null,slots[0]!.starts_at)).toBe("expired");
  });
  it("termine seulement à la fin retenue et préserve les états terminaux",()=>{
    expect(effectiveStatus("confirmed",now,slots,"a",slots[0]!.starts_at)).toBe("confirmed");
    expect(effectiveStatus("confirmed",now,slots,"a",slots[0]!.ends_at)).toBe("completed");
    for(const state of ["draft","cancelled","expired","completed"] as const)expect(effectiveStatus(state,now,slots,null,"2027-01-01T00:00:00Z")).toBe(state);
  });
});
