#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const runDir = resolve(process.env.BACKUP_RUN_DIR ?? "");
if (!url || !serviceKey || !runDir || runDir === resolve(".")) throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and BACKUP_RUN_DIR are required");
const manifest = JSON.parse(await readFile(resolve(runDir, "storage-manifest.json"), "utf8"));
const allowedBuckets = new Set(["uniform-imports", "uniform-artifacts", "uniform-render-temp", "uniform-pdf", "uniform-erp"]);
if (!Array.isArray(manifest.buckets) || manifest.buckets.some((bucket) => !allowedBuckets.has(bucket)) || new Set(manifest.buckets).size !== manifest.buckets.length) {
  throw new Error("Storage manifest contains an unapproved or duplicate bucket");
}
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
async function api(path, options = {}) {
  const response = await fetch(`${url.replace(/\/$/, "")}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) } });
  if (!response.ok && response.status !== 409) throw new Error(`Storage restore failed (${response.status})`);
  return response;
}
for (const bucket of manifest.buckets ?? []) {
  await api("/storage/v1/bucket", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: bucket, name: bucket, public: false }) });
}
for (const object of manifest.objects ?? []) {
  if (!object?.bucket || !allowedBuckets.has(object.bucket) || typeof object.name !== "string" || object.name.includes("..") || object.name.startsWith("/")) {
    throw new Error("Storage manifest contains an unsafe object path");
  }
  const path = resolve(runDir, object.path);
  if (!path.startsWith(runDir + "\\") && !path.startsWith(runDir + "/")) throw new Error("Storage manifest path escaped backup root");
  const bytes = await readFile(path);
  const actual = createHash("sha256").update(bytes).digest("hex");
  if (actual !== object.sha256 || bytes.byteLength !== object.bytes) throw new Error(`Backup hash mismatch for ${object.bucket}/${object.name}`);
  await api(`/storage/v1/object/${encodeURIComponent(object.bucket)}/${object.name.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST", headers: { "content-type": object.metadata?.mimetype ?? "application/octet-stream", "x-upsert": "false" }, body: bytes,
  });
}
console.log(`restored_storage_objects=${manifest.objects?.length ?? 0}`);
