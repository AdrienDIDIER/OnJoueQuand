import {mkdirSync,writeFileSync} from "node:fs";
import webpush from "web-push";
// Ne pas afficher les clés ni écraser une configuration existante.
mkdirSync(".tools",{recursive:true});
writeFileSync(".tools/vapid-local.json",JSON.stringify(webpush.generateVAPIDKeys(),null,2)+"\n",{flag:"wx",mode:0o600});
console.log("Clés VAPID créées dans .tools/vapid-local.json (ignoré par Git). Conservez la clé privée côté serveur uniquement.");
