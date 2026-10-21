import "server-only";
import type { BusyReader } from "../contracts";
// J4 : aucune session n'est encore persistée. J5 branchera le contrat sur les
// seuls RSVP positifs de sessions confirmées, avec leurs membres encore actifs.
export const readConfirmedCommitments: BusyReader = async () => ({});
