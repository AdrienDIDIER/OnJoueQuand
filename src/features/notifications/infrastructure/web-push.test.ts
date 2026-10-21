import {createECDH,createPublicKey,randomBytes,verify} from "node:crypto";
import webpush from "web-push";
import {it,expect} from "vitest";
it("le client stable produit un Push chiffré et un JWT VAPID vérifiable avec Node 24",()=>{
  const receiver=createECDH("prime256v1");receiver.generateKeys();const vapid=webpush.generateVAPIDKeys();
  const request=webpush.generateRequestDetails({endpoint:"https://fcm.googleapis.com/fcm/send/recette",keys:{p256dh:receiver.getPublicKey().toString("base64url"),auth:randomBytes(16).toString("base64url")}},"Message privé de recette",{vapidDetails:{...vapid,subject:"mailto:recette@example.test"},TTL:300});
  expect(request.method).toBe("POST");expect(request.headers.TTL).toBe(300);expect(request.body?.toString()).not.toContain("Message privé");
  const authorization=String(request.headers.Authorization);const token=/t=([^, ]+)/.exec(authorization)?.[1];expect(token).toBeTruthy();
  const [header,payload,signature]=token!.split(".");expect(JSON.parse(Buffer.from(payload!,"base64url").toString()).aud).toBe("https://fcm.googleapis.com");
  const raw=Buffer.from(vapid.publicKey,"base64url");const publicKey=createPublicKey({key:{kty:"EC",crv:"P-256",x:raw.subarray(1,33).toString("base64url"),y:raw.subarray(33).toString("base64url")},format:"jwk"});
  expect(verify("sha256",Buffer.from(`${header}.${payload}`),{key:publicKey,dsaEncoding:"ieee-p1363"},Buffer.from(signature!,"base64url"))).toBe(true);
});
