import {expect} from "@playwright/test";
import {test} from "./fixtures";
test("contrastes ciblés, réduction des animations et aide en français",async({page})=>{
  await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/groupe/reglages");
  const ratios=await page.evaluate(()=>{
    const rgb=(value:string)=>value.match(/[\d.]+/g)!.slice(0,3).map(Number);
    const luminance=(value:string)=>rgb(value).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i]!,0);
    return[document.body,document.querySelector(".pwa-install summary")!,document.querySelector(".nav-active")!].map(element=>{
      let parent:Element|null=element,background="";while(parent){background=getComputedStyle(parent).backgroundColor;if(background!=="rgba(0, 0, 0, 0)"&&background!=="transparent")break;parent=parent.parentElement;}
      const a=luminance(getComputedStyle(element).color),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
  });
  for(const ratio of ratios)expect(ratio).toBeGreaterThanOrEqual(4.5);
  expect(await page.locator(".nav-active").evaluate(element=>getComputedStyle(element).transitionDuration)).toBe("0s");
  await page.getByText("Installer OnJoueQuand",{exact:true}).click();await expect(page.getByText("Votre groupe, à portée de main.",{exact:true})).toBeVisible();await expect(page.locator("html")).toHaveAttribute("lang","fr");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
