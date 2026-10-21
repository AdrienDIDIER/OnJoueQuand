export function installationMode(input:{userAgent:string;platform:string;touchPoints:number;standalone:boolean}){
  if(input.standalone)return"installed" as const;
  if(/iPad|iPhone|iPod/.test(input.userAgent)||(input.platform==="MacIntel"&&input.touchPoints>1))return"ios" as const;
  return"browser" as const;
}
