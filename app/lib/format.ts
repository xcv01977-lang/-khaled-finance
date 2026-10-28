import { diffDays } from "./cycle";

export function dayLabel(date: string, today: string): string {
  const d = diffDays(date, today);
  if (d === 0) return "اليوم";
  if (d === 1) return "أمس";
  if (d === -1) return "بكرة";
  return `${+date.slice(8, 10)}/${+date.slice(5, 7)}`;
}

export function inDaysLabel(inDays: number): string {
  if (inDays === 0) return "اليوم";
  if (inDays === 1) return "بكرة";
  if (inDays === 2) return "بعد يومين";
  if (inDays > 2 && inDays <= 10) return `بعد ${inDays} أيام`;
  if (inDays > 10) return `بعد ${inDays} يوم`;
  if (inDays === -1) return "متأخرة يوم";
  if (inDays === -2) return "متأخرة يومين";
  return `متأخرة ${-inDays} يوم`;
}
