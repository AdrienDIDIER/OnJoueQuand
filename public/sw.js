// Push uniquement : aucune interception réseau, aucune donnée privée mise en cache.
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
