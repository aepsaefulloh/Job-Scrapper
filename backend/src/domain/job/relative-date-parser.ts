/**
 * Pure deterministic parser for relative and standard dates from job boards.
 * Converts relative expressions (Indonesian & English) into standardized ISO 8601 timestamps
 * using a given reference timestamp (defaults to current time).
 */
export function parseRelativeDate(
  raw: string | undefined | null,
  referenceDate = new Date()
): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;

  // 1. Direct standard ISO / YYYY-MM-DD format
  const isoTimestamp = Date.parse(trimmed);
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) && !Number.isNaN(isoTimestamp)) {
    return new Date(isoTimestamp).toISOString();
  }

  // Strip prefixes like "Posted ", "Diposting "
  const normalized = trimmed
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^(?:posted|diposting)\s+/i, '')
    .trim();

  // 2. "Today" / "Hari ini" / "Baru saja" / "Just now" / "< X hours/minutes/seconds ago" / "Xm ago" / "Xh ago"
  if (
    normalized === 'today' ||
    normalized === 'hari ini' ||
    normalized === 'baru saja' ||
    normalized === 'just now' ||
    /^(?:kurang dari\s+)?(?:\d+\s+)?(?:detik|second|menit|minute|jam|hour)s?\s+(?:yang\s+)?lalu$/i.test(normalized) ||
    /^(?:just now|< \d+ hours? ago|\d+\s*[hm]\s*ago)$/i.test(normalized)
  ) {
    return referenceDate.toISOString();
  }

  // 3. "Yesterday" / "Kemarin" / "1d ago"
  if (normalized === 'yesterday' || normalized === 'kemarin' || normalized === '1d ago') {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }

  // 4. "X days ago" / "X hari lalu" / "X hari yang lalu" / "Xd ago"
  const daysMatch = /^(\d+)\s*(?:hari(?:\s+yang)?\s+lalu|days?\s+ago|d\s+ago)$/i.exec(normalized);
  if (daysMatch && daysMatch[1]) {
    const days = parseInt(daysMatch[1], 10);
    if (Number.isFinite(days) && days >= 0 && days < 365) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - days);
      return d.toISOString();
    }
  }

  // 5. "X weeks ago" / "X minggu lalu" / "X minggu yang lalu" / "Xw ago"
  const weeksMatch = /^(\d+)\s*(?:minggu(?:\s+yang)?\s+lalu|weeks?\s+ago|w\s+ago)$/i.exec(normalized);
  if (weeksMatch && weeksMatch[1]) {
    const weeks = parseInt(weeksMatch[1], 10);
    if (Number.isFinite(weeks) && weeks >= 0 && weeks < 52) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - weeks * 7);
      return d.toISOString();
    }
  }

  // 6. "X months ago" / "X bulan lalu" / "X bulan yang lalu" / "X+ days ago" / "Xd+ ago"
  const monthsMatch = /^(\d+)\s*(?:bulan(?:\s+yang)?\s+lalu|months?\s+ago|mo\s+ago)$/i.exec(normalized);
  if (monthsMatch && monthsMatch[1]) {
    const months = parseInt(monthsMatch[1], 10);
    if (Number.isFinite(months) && months >= 0 && months < 24) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - months * 30);
      return d.toISOString();
    }
  }

  const plusDaysMatch = /^(\d+)\+?\s*(?:d\s*\+|days?\s*\+?)\s*ago$/i.exec(normalized);
  if (plusDaysMatch && plusDaysMatch[1]) {
    const days = parseInt(plusDaysMatch[1], 10);
    if (Number.isFinite(days) && days >= 0 && days < 365) {
      const d = new Date(referenceDate);
      d.setDate(d.getDate() - days);
      return d.toISOString();
    }
  }

  return undefined;
}
