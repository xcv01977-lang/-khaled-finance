export type Theme = "dark" | "light" | "system";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "system" ? t : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(t: Theme) {
  try { localStorage.setItem("theme", t); } catch {}
  const el = document.documentElement;
  if (t === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", t);
}
