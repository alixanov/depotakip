/** Parse a short human duration ("15m", "30d", "2h") into milliseconds. */
export function parseDuration(input: string): number {
  const match = /^(\d+)\s*(s|m|h|d)$/i.exec(input.trim());
  if (!match) throw new Error(`Invalid duration: "${input}"`);
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const mult: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * mult[unit];
}
