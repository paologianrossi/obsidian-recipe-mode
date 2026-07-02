/** Duration helpers: parse "20m", "1h30m", "45 min", "1 ora e 30", ISO "PT1H30M" → minutes. */

export function parseDuration(input: string | number | undefined): number | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  const s = input.trim();
  if (!s) return undefined;

  // ISO-8601: PT1H30M, PT45M, P0DT2H
  const iso = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso && (iso[1] || iso[2] || iso[3] || iso[4])) {
    return (
      (iso[1] ? parseFloat(iso[1]) * 1440 : 0) +
      (iso[2] ? parseFloat(iso[2]) * 60 : 0) +
      (iso[3] ? parseFloat(iso[3]) : 0) +
      (iso[4] ? parseFloat(iso[4]) / 60 : 0)
    );
  }

  // bare number = minutes
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return parseFloat(s.replace(",", "."));

  // "1h30m", "1 h 30 min", "2 ore", "90 minuti", "1 ora e 15"
  let minutes = 0;
  let found = false;
  const hourRe = /(\d+(?:[.,]\d+)?)\s*(?:h|hr|hrs|hour|hours|ora|ore)\b\.?/gi;
  const minRe = /(\d+(?:[.,]\d+)?)\s*(?:m|min|mins|minute|minutes|minuto|minuti)\b\.?/gi;
  for (const m of s.matchAll(hourRe)) {
    minutes += parseFloat(m[1]!.replace(",", ".")) * 60;
    found = true;
  }
  for (const m of s.matchAll(minRe)) {
    minutes += parseFloat(m[1]!.replace(",", "."));
    found = true;
  }
  if (found) return minutes;

  // "1 ora e 15" — trailing bare number after an hour word was handled above; give up
  return undefined;
}

/** 95 → "1h35m"; 45 → "45m". Frontmatter-friendly compact format. */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h${m}m`;
}

/** 95 → "1 h 35 min" for display. */
export function formatDurationLong(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
