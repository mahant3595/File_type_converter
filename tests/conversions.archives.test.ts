import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import AdmZip from "adm-zip";
import * as tar from "tar";
import { makeZip } from "./helpers";
import { expectConvertError, runTool } from "./run";

async function withDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "nexora-arch-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Build a tar fixture with node-tar (independent implementation). */
async function makeTarFixture(): Promise<Buffer> {
  return withDir(async (dir) => {
    await writeFile(path.join(dir, "readme.txt"), "hello from tar");
    const nested = path.join(dir, "docs");
    await import("node:fs/promises").then((fs) => fs.mkdir(nested, { recursive: true }));
    await writeFile(path.join(nested, "notes.txt"), "nested note");
    const out = path.join(dir, "fixture.tar");
    await tar.create({ file: out, gzip: false, cwd: dir }, ["readme.txt", "docs"]);
    return readFile(out);
  });
}

describe("archive conversions", () => {
  it("Files → ZIP packs every file with its content", async () => {
    const [out] = await runTool("files-to-zip", [
      { name: "a.txt", data: Buffer.from("alpha") },
      { name: "b.txt", data: Buffer.from("beta") },
    ]);
    expect(out!.name).toBe("files.zip");
    expect(out!.mime).toBe("application/zip");
    const zip = new AdmZip(out!.data);
    const names = zip.getEntries().map((e) => e.entryName).sort();
    expect(names).toEqual(["a.txt", "b.txt"]);
    expect(zip.readAsText("a.txt")).toBe("alpha");
    expect(zip.readAsText("b.txt")).toBe("beta");
  });

  it("Files → TAR produces an archive node-tar can read", async () => {
    const binary = Buffer.from("\u0000\u0001\u0002binary");
    const [out] = await runTool("files-to-tar", [
      { name: "a.txt", data: Buffer.from("alpha") },
      { name: "b.bin", data: binary },
    ]);
    expect(out!.mime).toBe("application/x-tar");

    await withDir(async (dir) => {
      const file = path.join(dir, "out.tar");
      await writeFile(file, out!.data);
      const listed: string[] = [];
      await tar.t({ file, onentry: (e) => void listed.push(e.path) });
      expect(listed.sort()).toEqual(["a.txt", "b.bin"]);

      const extractDir = path.join(dir, "x");
      await (await import("node:fs/promises")).mkdir(extractDir, { recursive: true });
      await tar.x({ file, cwd: extractDir });
      expect(await readFile(path.join(extractDir, "a.txt"), "utf8")).toBe("alpha");
      expect((await readFile(path.join(extractDir, "b.bin"))).equals(binary)).toBe(true);
    });
  });

  it("ZIP → TAR converts cross-format (reader verified against zip input)", async () => {
    const zip = makeZip([
      { name: "docs/readme.txt", data: "read me" },
      { name: "data.csv", data: "a,b\n1,2\n" },
    ]);
    const [out] = await runTool("zip-to-tar", [{ name: "bundle.zip", data: zip }]);
    expect(out!.name).toBe("bundle.tar");

    await withDir(async (dir) => {
      const file = path.join(dir, "out.tar");
      await writeFile(file, out!.data);
      const listed: string[] = [];
      await tar.t({ file, onentry: (e) => void listed.push(e.path) });
      expect(listed).toContain("docs/readme.txt");
      expect(listed).toContain("data.csv");
    });
  });

  it("TAR → ZIP converts archives produced by node-tar", async () => {
    const tarFixture = await makeTarFixture();
    const [out] = await runTool("tar-to-zip", [{ name: "fixture.tar", data: tarFixture }]);
    expect(out!.name).toBe("fixture.zip");
    const zip = new AdmZip(out!.data);
    const names = zip.getEntries().map((e) => e.entryName);
    expect(names).toContain("readme.txt");
    expect(names).toContain("docs/notes.txt");
    expect(zip.readAsText("readme.txt")).toBe("hello from tar");
  });

  it("Extract ZIP returns every file with traversal defused", async () => {
    const zip = makeZip([
      { name: "safe.txt", data: "fine" },
      { name: "../evil.txt", data: "evil" },
      { name: "docs/nested.txt", data: "nested" },
    ]);
    const outs = await runTool("extract-zip", [{ name: "in.zip", data: zip }]);
    expect(outs).toHaveLength(3);
    for (const o of outs) {
      expect(o.name).not.toContain("..");
      expect(o.name.startsWith("/")).toBe(false);
    }
    const byName = new Map(outs.map((o) => [o.name, o]));
    expect(byName.get("safe.txt")?.data.toString()).toBe("fine");
    expect(byName.get("evil.txt")?.data.toString()).toBe("evil"); // defused, not dropped
    expect(byName.get("docs/nested.txt")?.data.toString()).toBe("nested");
    expect(byName.get("safe.txt")?.mime).toBe("text/plain");
  });

  it("Extract TAR skips symlinks and defuses absolute paths", async () => {
    const outs = await runTool("extract-tar", [{ name: "fixture.tar", data: await makeTarFixture() }]);
    const names = outs.map((o) => o.name);
    expect(names).toContain("readme.txt");
    expect(names).toContain("docs/notes.txt");
    for (const n of names) {
      expect(n).not.toContain("..");
      expect(n.startsWith("/")).toBe(false);
    }
    const readme = outs.find((o) => o.name === "readme.txt");
    expect(readme?.data.toString()).toBe("hello from tar");
  });

  it("Extract TAR drops unsafe special entries (symlink)", async () => {
    await withDir(async (dir) => {
      const fs = await import("node:fs/promises");
      await writeFile(path.join(dir, "real.txt"), "real file");
      await fs.symlink("real.txt", path.join(dir, "link.txt"));
      const file = path.join(dir, "withlink.tar");
      await tar.create({ file, cwd: dir }, ["real.txt", "link.txt"]);
      const data = await readFile(file);
      const outs = await runTool("extract-tar", [{ name: "withlink.tar", data }]);
      expect(outs.map((o) => o.name)).toEqual(["real.txt"]);
    });
  });

  it("rejects garbage masquerading as an archive", async () => {
    const err = await expectConvertError(
      runTool("extract-tar", [{ name: "fake.tar", data: Buffer.from("just some random bytes, not a tar archive at all!!") }]),
      "corrupt_file",
      "invalid_file",
      "conversion_failed",
    );
    expect(err.message).not.toMatch(/node_modules|\/tmp/);
  });

  it("rejects a non-archive zip payload", async () => {
    const err = await expectConvertError(
      runTool("extract-zip", [{ name: "fake.zip", data: Buffer.from("PK but not really a zip file here") }]),
      "corrupt_file",
      "invalid_file",
      "conversion_failed",
    );
    expect(err.message.length).toBeGreaterThan(8);
  });
});
