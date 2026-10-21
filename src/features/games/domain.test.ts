import { expect,it } from "vitest";
import { gameSchema } from "./domain";
it("normalise un jeu et refuse les noms vides ou descriptions trop longues",()=>{
  expect(gameSchema.parse({name:"  Deep Rock Galactic  ",description:"  Coopération  "})).toEqual({name:"Deep Rock Galactic",description:"Coopération"});
  expect(gameSchema.safeParse({name:"  ",description:""}).success).toBe(false);
  expect(gameSchema.safeParse({name:"a".repeat(81),description:""}).success).toBe(false);
  expect(gameSchema.safeParse({name:"Jeu",description:"a".repeat(1001)}).success).toBe(false);
});
