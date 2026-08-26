import { randomUUID } from "node:crypto";

export function safeFileName(name: string) {
  return name.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").slice(0, 120);
}

export function projectSourceKey(projectId: string, fileName: string) {
  return `projects/${projectId}/sources/${randomUUID()}-${safeFileName(fileName)}`;
}
