import { expect, test, describe } from "bun:test";
import { getFamilyName, selectRoundRobinCandidate } from "../../src/auth/manager";

describe("Manager Utils", () => {
  test("getFamilyName should correctly classify models", () => {
    expect(getFamilyName("gemini-1.5-flash")).toBe("Gemini 3 Flash");
    expect(getFamilyName("gemini-1.5-pro")).toBe("Gemini 3 Pro");
    expect(getFamilyName("claude-3-5-sonnet")).toBe("Claude/GPT");
    expect(getFamilyName("gpt-4o")).toBe("Claude/GPT");
    expect(getFamilyName("gemini-2.5-flash")).toBe("Gemini 2.5");
    expect(getFamilyName("unknown-model")).toBe("Other");
  });

  test("round-robin selection advances across eligible accounts", () => {
    const candidates = [
      { email: "one@example.test" },
      { email: "two@example.test" },
      { email: "three@example.test" },
    ];
    const rotationKey = `unit-test-${Date.now()}-${Math.random()}`;

    expect(selectRoundRobinCandidate(candidates, rotationKey)?.email).toBe("one@example.test");
    expect(selectRoundRobinCandidate(candidates, rotationKey)?.email).toBe("two@example.test");
    expect(selectRoundRobinCandidate(candidates, rotationKey)?.email).toBe("three@example.test");
    expect(selectRoundRobinCandidate(candidates, rotationKey)?.email).toBe("one@example.test");
  });
});
