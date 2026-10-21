import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const nameSchema = z.string().trim().min(1).max(60);
export const codeSchema = z.string().regex(/^\d{6}$/);
export type ActionState = { message: string; ok?: boolean };
export const initialState: ActionState = { message: "" };
