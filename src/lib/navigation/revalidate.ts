import "server-only";
import {revalidatePath} from "next/cache";

// Invalider également les vues préchargées et leurs sous-routes après une mutation.
export function revalidatePrivateViews(){revalidatePath("/","layout");}
