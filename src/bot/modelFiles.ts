// Server-only: reads AZ models (manifest JSON + float32 parameters file).
import fs from "fs";
import path from "path";
import { AzModel, ModelManifest, decodeParams } from "./network";

export function readModel(manifestFile: string): AzModel {
  const manifest = JSON.parse(
    fs.readFileSync(manifestFile, "utf8")
  ) as ModelManifest;
  const params = decodeParams(
    fs.readFileSync(path.join(path.dirname(manifestFile), manifest.weightsFile))
  );
  return new AzModel(manifest, params);
}

// Whether the JSON file looks like a model manifest (cheap: no validation).
export function isModelManifest(json: unknown): json is ModelManifest {
  return (
    !!json &&
    typeof json === "object" &&
    (json as ModelManifest).format === "everdell-az-mlp"
  );
}

const cache = new Map<string, { mtimeMs: number; model: AzModel }>();

// Models are immutable once loaded and the forward pass is synchronous, so
// one instance can serve every bot of the process.
export function loadModel(manifestFile: string): AzModel {
  const file = path.resolve(manifestFile);
  const { mtimeMs } = fs.statSync(file);
  const cached = cache.get(file);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.model;
  }
  const model = readModel(file);
  cache.set(file, { mtimeMs, model });
  return model;
}
