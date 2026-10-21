import {describe,it,expect} from "vitest";
import {notificationContent,pushOutcome,reminderWindow,subscriptionSchema} from "./domain";
import {deliver,type Delivery} from "./application/delivery";
import {validJobSecret} from "./infrastructure/job-auth";
const now="2026-10-25T17:00:00Z";
const delivery:Delivery={endpoint:`https://fcm.googleapis.com/fcm/send/${"a".repeat(50)}`,keys:{p256dh:"a".repeat(87),auth:"a".repeat(22)},notification_id:"123",expires_at:"2026-10-26T17:00:00Z",type:"session.confirmed",attempts:1};
describe("rappels Europe/Paris",()=>{
  it("dimanche 18 h cible le lundi suivant, été et hiver",()=>{
    expect(reminderWindow("2026-07-05T15:59:59Z")).toBeNull();
    expect(reminderWindow("2026-07-05T16:00:00Z")).toEqual({week:"2026-07-06",stage:"sunday",due:"2026-07-05T16:00:00Z",expires:"2026-07-06T16:00:00Z"});
    expect(reminderWindow(now)?.week).toBe("2026-10-26");expect(reminderWindow("2026-10-25T16:59:59Z")).toBeNull();
  });
  it("rattrape une seule étape et arrête mardi à 18 h",()=>{
    expect(reminderWindow("2026-10-26T16:59:59Z")?.stage).toBe("sunday");
    expect(reminderWindow("2026-10-26T17:00:00Z")).toMatchObject({week:"2026-10-26",stage:"monday"});
    expect(reminderWindow("2026-10-27T17:00:00Z")).toBeNull();expect(reminderWindow("2026-10-28T12:00:00Z")).toBeNull();
  });
  it("respecte le printemps et le passage d’année ISO",()=>{
    expect(reminderWindow("2027-03-28T16:00:00Z")?.due).toBe("2027-03-28T16:00:00Z");
    expect(reminderWindow("2026-12-27T17:00:00Z")?.week).toBe("2026-12-28");
    expect(reminderWindow("2027-01-03T17:00:00Z")?.week).toBe("2027-01-04");
  });
});
describe("livraison Push bornée et sans détails privés",()=>{
  it("refuse les endpoints arbitraires, identifiants, ports et domaines ressemblants",()=>{
    for(const endpoint of ["http://127.0.0.1/push","https://169.254.169.254/latest/meta-data/","https://fcm.googleapis.com.evil.test/fcm/send/abc","https://user@fcm.googleapis.com/fcm/send/abc","https://fcm.googleapis.com:443/fcm/send/abc","https://fcm.googleapis.com/fcm/send/abc?url=http://localhost"])
      expect(subscriptionSchema.safeParse({...delivery,endpoint}).success).toBe(false);
    expect(subscriptionSchema.safeParse(delivery).success).toBe(true);
  });
  it("envoie un texte générique avec tag stable et TTL, sans nom de jeu ni participant",async()=>{
    let body="";const result=await deliver(delivery,async(_s,payload,ttl)=>{body=payload;expect(ttl).toBe(86400);},now,0);
    expect(result.outcome).toBe("sent");expect(JSON.parse(body)).toMatchObject({title:"OnJoueQuand",tag:"ojq:123",url:"/accueil#notifications"});expect(body).not.toContain("session.confirmed");
  });
  it("ne fait aucun réseau pour un endpoint interdit ou une notification expirée",async()=>{
    const send=async()=>{throw new Error("Le transport ne doit pas être appelé");};
    expect((await deliver({...delivery,endpoint:"https://localhost/push"},send,now,0)).error_code).toBe("invalid_endpoint");
    expect((await deliver({...delivery,expires_at:now},send,now,0)).outcome).toBe("skipped");
  });
  it("distingue les endpoints morts, erreurs permanentes et temporaires",async()=>{
    for(const [status,outcome] of [[404,"gone"],[410,"gone"],[400,"failed"],[401,"failed"],[429,"retry"],[503,"retry"]] as const){
      const result=await deliver(delivery,async()=>{throw{statusCode:status,headers:{"retry-after":"300"}};},now,0);expect(result.outcome).toBe(outcome);if(outcome==="retry")expect(result.retry_seconds).toBe(300);
    }
    expect(pushOutcome(undefined,3,undefined,now,0).retry_seconds).toBe(240);
    expect(pushOutcome(503,1,"Sun, 25 Oct 2026 17:10:00 GMT",now,0).retry_seconds).toBe(600);
  });
  it("ne permet ni mauvais secret ni secret trop court et accepte la rotation",()=>{
    const a="a".repeat(32),b="b".repeat(32);expect(validJobSecret(`Bearer ${a}`,[a,b])).toBe(true);expect(validJobSecret(`Bearer ${b}`,[a,b])).toBe(true);
    for(const header of [null,"Bearer mauvais",`Basic ${a}`])expect(validJobSecret(header,[a,b])).toBe(false);expect(validJobSecret("Bearer petit",["petit"])).toBe(false);
  });
  it("produit des liens internes et des messages français",()=>{
    expect(notificationContent("availability.reminder",{week:"2026-10-26"},"id").url).toBe("/dispos?semaine=2026-10-26");
    expect(notificationContent("session.cancelled",{},"id").title).toBe("Une session a été annulée");
  });
});
