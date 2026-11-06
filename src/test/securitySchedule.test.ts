import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("daily security schedule", () => {
  it("runs once every day, including weekends", () => {
    const workflow = readFileSync(".github/workflows/security-daily.yml", "utf8");
    const schedules = [...workflow.matchAll(/cron:\s*'([^']+)'/g)].map((match) => match[1]);
    expect(schedules).toEqual(["0 0 * * *"]);
  });
});