import { Project } from "./types";

const key = "micrographics-label-studio:project";

export function saveLocal(project: Project) {
  localStorage.setItem(key, JSON.stringify(project));
}

export function loadLocal(): Project | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}
