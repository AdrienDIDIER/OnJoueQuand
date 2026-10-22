import "server-only";
import {revalidatePath} from "next/cache";

// Server Action : réconcilier le rendu ; Route Handler : marquer les prochaines lectures.
// Le contexte client des disponibilités réconcilie immédiatement ses confirmations JSON (ADR 024).
export function revalidatePrivateViews(){revalidatePath("/","layout");}
