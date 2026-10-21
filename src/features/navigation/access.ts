import "server-only";
import { createHash } from "node:crypto";

type Membership={id:string;role:string;revision:number;participation_epoch:number};
// Identifiant opaque du contexte de lecture, jamais un jeton d’autorisation.
export function navigationAccessKey(userId:string,member:Membership) {
  return createHash("sha256").update(JSON.stringify([userId,member.id,member.role,member.revision,member.participation_epoch])).digest("hex");
}
