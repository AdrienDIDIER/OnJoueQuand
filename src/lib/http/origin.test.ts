import {expect,it} from "vitest";
import {isSameOriginCommand} from "./origin";
const request=(origin:string,host="onjouequand.example",extra:Record<string,string>={})=>new Request("http://localhost:3100/api/availability/quick",{headers:{Origin:origin,Host:host,...extra}});
it("reconnaît l’hôte public même avec une URL interne de proxy",()=>{
  expect(isSameOriginCommand(request("https://onjouequand.example"))).toBe(true);
  expect(isSameOriginCommand(request("http://127.0.0.1:3100","127.0.0.1:3100"))).toBe(true);
});
it("refuse une origine étrangère, absente, mal formée ou marquée cross-site",()=>{
  for(const origin of ["https://externe.example","null","","https://onjouequand.example/chemin","https://compte@onjouequand.example"])
    expect(isSameOriginCommand(request(origin))).toBe(false);
  expect(isSameOriginCommand(request("https://onjouequand.example","onjouequand.example",{"sec-fetch-site":"cross-site"}))).toBe(false);
});
it("ne fait pas confiance à un hôte transféré fourni par le client et exige HTTPS hors local",()=>{
  expect(isSameOriginCommand(request("https://externe.example","onjouequand.example",{"x-forwarded-host":"externe.example"}))).toBe(false);
  expect(isSameOriginCommand(request("http://onjouequand.example"))).toBe(false);
});
