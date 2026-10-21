import type { TimeRange } from "./domain";
export type BusyRequest = { memberIds: string[]; starts_at: string; ends_at: string };
export type BusyReader = (request: BusyRequest) => Promise<Record<string, TimeRange[]>>;
