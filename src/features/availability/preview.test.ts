import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readPreview, signPreview } from "./preview";
describe("Aperçu signé des disponibilités", () => {
  it("lie la confirmation à son acteur, son contenu et son expiration", () => {
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "a".repeat(32));
    const plan = { actor: "compte-a", expires: 200, changes: [], guards: [] };
    const token = signPreview(plan);
    expect(readPreview(token, "compte-a", 100)).toEqual(plan);
    expect(() => readPreview(token, "compte-b", 100)).toThrow("expiré");
    expect(() => readPreview(token, "compte-a", 200)).toThrow("expiré");
    const [data, signature] = token.split(".");
    expect(() => readPreview(`${data}x.${signature}`, "compte-a", 100)).toThrow("invalide");
    vi.unstubAllEnvs();
  });
});
