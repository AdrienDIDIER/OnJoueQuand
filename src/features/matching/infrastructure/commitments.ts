import "server-only";
import type { BusyReader } from "../contracts";
import { readConfirmedBusy } from "@/features/sessions/queries";
export const readConfirmedCommitments: BusyReader = async request => {
  const rows=await readConfirmedBusy(request.memberIds,request.starts_at,request.ends_at);
  const result:Awaited<ReturnType<BusyReader>>={};
  for(const row of rows) (result[row.membership_id]??=[]).push({starts_at:row.starts_at,ends_at:row.ends_at});
  return result;
};
