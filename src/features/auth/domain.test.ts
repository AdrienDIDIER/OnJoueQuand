import { describe, expect, it } from "vitest";
import { codeSchema, emailSchema, nameSchema } from "./domain";
describe("Identité saisie", () => {
  it("normalise sans supprimer le suffixe ni les points", () => {
    expect(emailSchema.parse(" A.B+jeu@EXAMPLE.TEST ")).toBe("a.b+jeu@example.test");
  });
  it("refuse adresse, nom vide et code ambigu", () => {
    expect(emailSchema.safeParse("invalide").success).toBe(false);
    expect(nameSchema.safeParse("   ").success).toBe(false);
    expect(codeSchema.safeParse("12345").success).toBe(false);
    expect(codeSchema.safeParse("12345a").success).toBe(false);
    expect(codeSchema.parse("012345")).toBe("012345");
  });
});
