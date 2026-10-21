import {it,expect} from "vitest";
import {installationMode} from "./domain";
it("adapte l’aide à iOS, iPadOS et au mode installé sans promettre un prompt universel",()=>{
  const desktop={userAgent:"Mozilla Macintosh",platform:"MacIntel",touchPoints:0,standalone:false};
  expect(installationMode(desktop)).toBe("browser");
  expect(installationMode({...desktop,touchPoints:5})).toBe("ios");
  expect(installationMode({...desktop,userAgent:"Mozilla iPhone"})).toBe("ios");
  expect(installationMode({...desktop,userAgent:"Mozilla Android",platform:"Linux"})).toBe("browser");
  expect(installationMode({...desktop,userAgent:"iPhone",standalone:true})).toBe("installed");
});
