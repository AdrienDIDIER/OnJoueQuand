import {afterEach,beforeEach,expect,it,vi} from "vitest";
vi.mock("../actions",()=>({subscribeDevice:vi.fn()}));
import {subscribeDevice} from "../actions";
import {activateDevice} from "./activate-device";

let request:ReturnType<typeof vi.fn>,subscribe:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  request=vi.fn().mockResolvedValue("granted");subscribe=vi.fn().mockResolvedValue({toJSON:()=>({endpoint:"abonnement de recette"})});
  const notification={permission:"default",requestPermission:request};
  vi.stubGlobal("window",{isSecureContext:true,PushManager:function(){},Notification:notification});
  vi.stubGlobal("Notification",notification);
  vi.stubGlobal("navigator",{serviceWorker:{register:vi.fn().mockResolvedValue({}),ready:Promise.resolve({pushManager:{getSubscription:vi.fn().mockResolvedValue(null),subscribe}})}});
  vi.mocked(subscribeDevice).mockResolvedValue({done:true,message:"Notifications activées sur cet appareil."});
});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
it("sans configuration, ne demande aucune autorisation",async()=>{
  expect((await activateDevice("",vi.fn())).done).not.toBe(true);expect(request).not.toHaveBeenCalled();
});
it("enregistre réellement l’abonnement avant d’annoncer le succès",async()=>{
  const result=await activateDevice("BA",vi.fn());
  expect(request).toHaveBeenCalledOnce();expect(subscribeDevice).toHaveBeenCalledWith({endpoint:"abonnement de recette"});expect(result.done).toBe(true);
});
it("ne redemande pas une permission bloquée",async()=>{
  Object.defineProperty(Notification,"permission",{value:"denied"});
  expect((await activateDevice("BA",vi.fn())).message).toContain("bloquées");expect(request).not.toHaveBeenCalled();expect(subscribeDevice).not.toHaveBeenCalled();
});
it("ne transforme pas un refus serveur en activation réussie",async()=>{
  vi.mocked(subscribeDevice).mockResolvedValue({message:"Activation refusée."});
  expect((await activateDevice("BA",vi.fn())).done).not.toBe(true);
});
it("explique une erreur d’abonnement sans interrompre l’application",async()=>{
  subscribe.mockRejectedValue(new Error("indisponible"));
  expect((await activateDevice("BA",vi.fn())).message).toContain("Activation impossible");
});
