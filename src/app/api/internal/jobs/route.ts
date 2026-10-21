import { NextResponse } from "next/server";
import { validJobSecret } from "@/features/notifications/infrastructure/job-auth";
import { runNotificationJob } from "@/features/notifications/infrastructure/worker";
export const runtime="nodejs";
export const maxDuration=60;
export async function POST(request:Request){
  const headers={"Cache-Control":"no-store"};
  if(!process.env.JOBS_SECRET||process.env.JOBS_SECRET.length<32)return NextResponse.json({message:"Traitement non configuré."},{status:503,headers});
  if(!validJobSecret(request.headers.get("authorization"),[process.env.JOBS_SECRET,process.env.JOBS_SECRET_PREVIOUS]))return NextResponse.json({message:"Accès refusé."},{status:401,headers});
  try{return NextResponse.json(await runNotificationJob(),{headers});}catch{return NextResponse.json({message:"Traitement indisponible. Réessayez plus tard."},{status:503,headers});}
}
