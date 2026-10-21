import { z } from "zod";
export const gameSchema = z.object({ name:z.string().trim().min(1).max(80), description:z.string().trim().max(1000) });
