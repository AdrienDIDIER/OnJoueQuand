// Ne jamais ajouter de page authentifiée, API, RSC ou jeton à cette liste.
const CACHE="ojq-public-v1";
const PUBLIC_ASSETS=["/offline.html","/icons/icon-192.png","/icons/icon-512.png","/icons/maskable-512.png","/icons/apple-touch-icon.png"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS.map(url=>new Request(url,{cache:"reload"})))));
  // Une mise à jour attend la fermeture des anciens clients ou une décision explicite.
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith("ojq-public-")&&key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener("message",event=>{
  if(event.data?.type==="ACTIVATE_UPDATE")event.waitUntil(self.skipWaiting());
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin)return;
  if(!url.search&&PUBLIC_ASSETS.includes(url.pathname)){
    event.respondWith(caches.open(CACHE).then(async cache=>await cache.match(url.pathname)??fetch(request)));return;
  }
  // Les appels API, actions POST, RSC et chunks ne reçoivent jamais de HTML de repli.
  if(request.mode!=="navigate"||url.pathname.startsWith("/api/")||url.pathname.startsWith("/_next/")||url.searchParams.has("_rsc")||request.headers.has("RSC"))return;
  event.respondWith(fetch(new Request(request,{cache:"no-store"})).catch(async()=>{
    const cache=await caches.open(CACHE);return await cache.match("/offline.html")??new Response("Vous êtes hors connexion. Reconnectez-vous puis réessayez.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
  }));
});
self.addEventListener("push",event=>{
  let data={};try{data=event.data?.json()??{};}catch{/* Payload invalide : message générique. */}
  event.waitUntil(self.registration.showNotification("OnJoueQuand",{
    body:typeof data.body==="string"?data.body.slice(0,180):"Une nouvelle information vous attend dans votre groupe.",
    tag:typeof data.tag==="string"?data.tag.slice(0,100):"ojq-information",
    data:{url:"/accueil#notifications"},
  }));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  event.waitUntil((async()=>{
    const url=new URL("/accueil#notifications",self.location.origin).href;
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const existing=windows.find(client=>new URL(client.url).origin===self.location.origin);
    if(existing){await existing.navigate(url);await existing.focus();}else await self.clients.openWindow(url);
  })());
});
