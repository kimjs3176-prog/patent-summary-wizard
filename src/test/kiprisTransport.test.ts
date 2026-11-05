/// <reference types="node" />
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * KIPRIS Plus calls carry the service key in the query string, so every call
 * must go over TLS. This guards against a plain-http URL sneaking back in.
 */
const FUNCTIONS_DIR = join(__dirname, "..", "..", "supabase", "functions");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|js)$/.test(name)) out.push(full);
  }
  return out;
}

describe("KIPRIS transport", () => {
  it("never calls plus.kipris.or.kr over plain http", () => {
    const offenders = walk(FUNCTIONS_DIR).filter((file) => /http:\/\/plus\.kipris\.or\.kr/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });
});
