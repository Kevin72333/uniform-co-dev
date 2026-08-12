#!/usr/bin/env node
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const root = resolve(process.argv[2] ?? process.env.BACKUP_RUN_DIR ?? "");
if (!root || root === resolve(".")) throw new Error("BACKUP_RUN_DIR is required");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === "manifest.json") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

async function digest(path) {
  const hash = createHash("sha256");
  await new Promise((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolvePromise);
  });
  return hash.digest("hex");
}

const files = [];
for (const path of await walk(root)) {
  const info = await stat(path);
  files.push({ path: relative(root, path).replaceAll("\\", "/"), bytes: info.size, sha256: await digest(path) });
}
files.sort((left, right) => left.path.localeCompare(right.path));
await writeFile(join(root, "manifest.json"), `${JSON.stringify({
  schema: "uniform-co-backup-manifest-v1",
  generatedAt: new Date().toISOString(),
  nodeVersion: process.version,
  files,
}, null, 2)}\n`, { mode: 0o600 });
