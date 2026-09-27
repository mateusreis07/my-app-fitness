/** Calendário do perfil; fallback para o fuso do dispositivo e, por último, UTC. */
export function resolveTimeZone(value?: string | null): string {
  for (const candidate of [value, Intl.DateTimeFormat().resolvedOptions().timeZone, 'UTC']) {
    if (!candidate) continue;
    try {
      new Intl.DateTimeFormat('pt-BR', { timeZone: candidate }).format(0);
      return candidate;
    } catch {
      /* próximo fallback */
    }
  }
  return 'UTC';
}
export function dashboardClock(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  const hour = Number(part('hour'));
  return {
    dayKey: `${part('year')}-${part('month')}-${part('day')}`,
    minuteOfDay: hour * 60 + Number(part('minute')),
    greeting: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening',
  } as const;
}
export function formatDashboardDate(
  instant: string | Date,
  timeZone: string,
  full = false,
): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: 'numeric',
    month: full ? 'long' : 'short',
    ...(full ? { weekday: 'long' as const } : { year: 'numeric' as const }),
  }).format(new Date(instant));
}
