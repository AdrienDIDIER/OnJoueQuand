import {createHash,timingSafeEqual} from "node:crypto";
export function validJobSecret(header:string|null,secrets:(string|undefined)[]){
  const provided=createHash("sha256").update(header??"").digest();let valid=false;
  for(const secret of secrets){if(!secret||secret.length<32)continue;const expected=createHash("sha256").update(`Bearer ${secret}`).digest();valid=timingSafeEqual(provided,expected)||valid;}
  return valid;
}
