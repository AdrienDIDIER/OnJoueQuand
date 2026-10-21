import type {MetadataRoute} from "next";
export const dynamic="force-static";
export default function manifest():MetadataRoute.Manifest{
  return{id:"/",name:"OnJoueQuand",short_name:"OnJoueQuand",description:"Votre groupe privé pour trouver le bon moment et jouer ensemble.",lang:"fr",start_url:"/accueil",scope:"/",display:"standalone",background_color:"#1b1c19",theme_color:"#1b1c19",orientation:"any",icons:[
    {src:"/icons/icon-192.png",sizes:"192x192",type:"image/png",purpose:"any"},
    {src:"/icons/icon-512.png",sizes:"512x512",type:"image/png",purpose:"any"},
    {src:"/icons/maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"},
  ]};
}
