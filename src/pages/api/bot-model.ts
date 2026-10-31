import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { listModelFiles, modelManifestFile } from "../../bot/botCatalog";

// AZ models for the arena page, which builds its bots in the browser:
// ?file=<model directory under weights/>&part=manifest|params. Only listed
// models are served, so client input can't reach other paths.
export default (req: NextApiRequest, res: NextApiResponse): void => {
  const file = String(req.query.file || "");
  if (!listModelFiles().includes(file)) {
    res.status(404).json({ error: `Unknown model: ${file}` });
    return;
  }
  const manifestFile = modelManifestFile(file);
  if (req.query.part === "params") {
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(
      fs.readFileSync(
        path.join(
          path.dirname(manifestFile),
          path.basename(manifest.weightsFile)
        )
      )
    );
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.send(fs.readFileSync(manifestFile, "utf8"));
};
