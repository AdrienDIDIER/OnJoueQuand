import {beforeEach,expect,it,vi} from "vitest";

vi.mock("server-only",()=>({}));
vi.mock("react",()=>({cache:(fn:unknown)=>fn}));
vi.mock("next/navigation",()=>({redirect:(url:string)=>{throw new Error(`redirect:${url}`);}}));
vi.mock("@/lib/env/server",()=>({getPublicEnv:()=>({supabase:{}})}));
vi.mock("@/lib/supabase/server",()=>({userClient:vi.fn()}));
import {userClient} from "@/lib/supabase/server";
import {requireMember} from "./server";

const member={id:"adhesion",status:"active"};
const getUser=vi.fn(),getClaims=vi.fn(),maybeSingle=vi.fn();
const query={select:vi.fn(),eq:vi.fn(),maybeSingle};
beforeEach(()=>{
  vi.clearAllMocks();
  query.select.mockReturnValue(query);query.eq.mockReturnValue(query);
  getClaims.mockResolvedValue({data:{claims:{sub:"compte"}},error:null});
  getUser.mockResolvedValue({data:{user:{id:"compte"}},error:null});
  maybeSingle.mockResolvedValue({data:member,error:null});
  vi.mocked(userClient).mockResolvedValue({auth:{getUser,getClaims},from:()=>query} as unknown as Awaited<ReturnType<typeof userClient>>);
});

it("lance la lecture RLS sans attendre Auth, mais ne rend aucun droit avant sa validation",async()=>{
  let finish!:()=>void;
  getUser.mockImplementation(()=>new Promise(resolve=>{finish=()=>resolve({data:{user:{id:"compte"}},error:null});}));
  let resolved=false;
  const request=requireMember().then(value=>{resolved=true;return value;});
  await vi.waitFor(()=>expect(maybeSingle).toHaveBeenCalledOnce());
  expect(resolved).toBe(false);
  finish();expect((await request).member).toEqual(member);
  expect(query.eq).toHaveBeenCalledWith("user_id","compte");
});
it("un JWT valide ne suffit pas si Auth refuse le compte",async()=>{
  getUser.mockResolvedValue({data:{user:null},error:{status:401}});
  await expect(requireMember()).rejects.toThrow("redirect:/connexion");
});
it("refuse un compte différent du sujet signé",async()=>{
  getUser.mockResolvedValue({data:{user:{id:"autre"}},error:null});
  await expect(requireMember()).rejects.toThrow("redirect:/connexion");
});
it("un membre révoqué ou absent n’obtient pas de contexte",async()=>{
  maybeSingle.mockResolvedValue({data:null,error:null});
  await expect(requireMember()).rejects.toThrow("redirect:/rejoindre");
});
it("ne lit aucune adhésion à partir de claims invalides",async()=>{
  getClaims.mockResolvedValue({data:null,error:{status:401}});
  await expect(requireMember()).rejects.toThrow("redirect:/connexion");
  expect(maybeSingle).not.toHaveBeenCalled();
});
it("une panne RLS est expliquée sans devenir une adhésion absente",async()=>{
  maybeSingle.mockResolvedValue({data:null,error:{message:"indisponible"}});
  await expect(requireMember()).rejects.toThrow("groupe est temporairement indisponible");
});
