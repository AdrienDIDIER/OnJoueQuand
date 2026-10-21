import {NextResponse} from "next/server";
import {userClient} from "@/lib/supabase/server";
import {navigationAccessKey} from "@/features/navigation/access";
export async function GET(){
  const headers={"Cache-Control":"private, no-store"};
  try{
    const client=await userClient();
    const claims=await client.auth.getClaims();
    if(claims.error&&claims.error.status!==400&&claims.error.status!==401&&claims.error.status!==403)return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});
    const subject=claims.data?.claims.sub;
    if(!subject)return NextResponse.json({message:"Reconnectez-vous pour continuer."},{status:401,headers});
    // La signature fournit un sélecteur vérifié ; Auth reste contrôlé en direct avant toute réponse positive.
    const [account,member]=await Promise.all([
      client.auth.getUser(),
      client.from("memberships").select("id,role,revision,participation_epoch").eq("user_id",subject).eq("status","active").maybeSingle(),
    ]);
    const {data:{user},error}=account;
    if(error&&error.status!==400&&error.status!==401&&error.status!==403)return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});
    if(!user||user.id!==subject)return NextResponse.json({message:"Reconnectez-vous pour continuer."},{status:401,headers});
    if(member.error)return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});
    if(!member.data)return NextResponse.json({message:"Votre accès au groupe n’est plus actif."},{status:403,headers});
    return NextResponse.json({active:true,accessKey:navigationAccessKey(user.id,member.data)},{headers});
  }catch{return NextResponse.json({message:"Vérification temporairement indisponible."},{status:503,headers});}
}
