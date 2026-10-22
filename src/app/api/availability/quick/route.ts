import {NextResponse} from "next/server";
import {requireMember} from "@/features/auth/server";
import {saveQuickAvailability} from "@/features/availability/quick-command";
import {revalidatePrivateViews} from "@/lib/navigation/revalidate";
import {navigationAccessKey} from "@/features/navigation/access";
import {isSameOriginCommand} from "@/lib/http/origin";

const headers={"Cache-Control":"private, no-store"};
export async function POST(request:Request){
  if(!isSameOriginCommand(request))return NextResponse.json({message:"Origine de la demande refusée."},{status:403,headers});
  if(request.headers.get("content-type")?.split(";")[0]?.trim()!=="application/json")return NextResponse.json({message:"Format de la demande refusé."},{status:415,headers});
  let body:unknown;
  try{
    if(Number(request.headers.get("content-length"))>4096)return NextResponse.json({message:"Demande trop volumineuse."},{status:413,headers});
    const reader=request.body?.getReader(),parts:Uint8Array[]=[];
    let length=0;
    if(reader)try{
      while(true){
        const part=await reader.read();if(part.done)break;
        length+=part.value.byteLength;
        if(length>4096){await reader.cancel();return NextResponse.json({message:"Demande trop volumineuse."},{status:413,headers});}
        parts.push(part.value);
      }
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(length);let offset=0;
    for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
    body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  }catch{return NextResponse.json({message:"Réponse invalide."},{status:400,headers});}
  const start=performance.now();
  const context=await requireMember();
  const authorized=performance.now();
  if(request.headers.get("x-ojq-context")!==navigationAccessKey(context.user.id,context.member))return NextResponse.json({code:"context_changed",message:"Votre accès a changé. Rechargez la page avant de continuer."},{status:409,headers});
  const result=await saveQuickAvailability(context,body);
  // Depuis une Route Handler, ne pas renvoyer un rendu complet de l’application avec l’accusé d’enregistrement.
  if(result.done)revalidatePrivateViews();
  return NextResponse.json(result,{status:result.done?200:409,headers:{...headers,"Server-Timing":`auth;dur=${(authorized-start).toFixed(1)},command;dur=${(performance.now()-authorized).toFixed(1)}`}});
}
