import {NextResponse} from "next/server";
import {userClient} from "@/lib/supabase/server";
export async function GET(){
  const headers={"Cache-Control":"private, no-store"};
  try{
    const client=await userClient();const {data:{user},error}=await client.auth.getUser();
    if(error&&error.status!==400&&error.status!==401&&error.status!==403)return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});
    if(!user)return NextResponse.json({message:"Reconnectez-vous pour continuer."},{status:401,headers});
    const member=await client.from("memberships").select("id").eq("user_id",user.id).eq("status","active").maybeSingle();
    if(member.error)return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});
    if(!member.data)return NextResponse.json({message:"Votre accès au groupe n’est plus actif."},{status:403,headers});
    return NextResponse.json({active:true},{headers});
  }catch{return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});}
}
