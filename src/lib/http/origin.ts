/** Host décrit l’hôte public ; l’URL interne de Next peut utiliser localhost derrière un proxy. */
export function isSameOriginCommand(request:Pick<Request,"headers"|"url">){
  try{
    const value=request.headers.get("origin");
    if(!value||request.headers.get("sec-fetch-site")==="cross-site")return false;
    const origin=new URL(value);
    const secure=origin.protocol==="https:"||(origin.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(origin.hostname));
    return secure&&value===origin.origin&&origin.host===(request.headers.get("host")??new URL(request.url).host);
  }catch{return false;}
}
