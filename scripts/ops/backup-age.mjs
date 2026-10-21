import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function backupIsRecent(run, artifacts, now) {
  if (run?.conclusion !== "success") return false;
  const finished = Date.parse(run.updated_at);
  const started = Date.parse(run.run_started_at);
  if (![started, finished].every((date) => Number.isFinite(date) && date <= now && now - date < 86400000)) return false;
  return artifacts.some((artifact) => {
    const created = Date.parse(artifact.created_at);
    return artifact.name === `sauvegarde-${run.id}` && artifact.expired === false && artifact.size_in_bytes > 0 && Number.isFinite(created) && created >= started && created <= now && now - created < 86400000 && Date.parse(artifact.expires_at) > now;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const repository = process.env.GITHUB_REPOSITORY;
    if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository ?? "") || !process.env.GITHUB_TOKEN) throw new Error();
    const get = async (path) => {
      const response = await fetch(`https://api.github.com/repos/${repository}${path}`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json" }, redirect: "error", signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error();
      return response.json();
    };
    if ((await get("")).private !== true) throw new Error();
    const run = (await get("/actions/workflows/backup.yml/runs?status=success&per_page=1")).workflow_runs?.[0];
    const artifacts = run ? (await get(`/actions/runs/${run.id}/artifacts`)).artifacts : [];
    if (!backupIsRecent(run, artifacts, Date.now())) {
      console.error("Aucune sauvegarde réussie téléchargeable de moins de 24 heures."); process.exitCode = 1;
    } else console.log("Sauvegarde récente et artefact privé présent. La récupération doit être testée séparément.");
  } catch { console.error("Impossible de vérifier la sauvegarde privée."); process.exitCode = 2; }
}
