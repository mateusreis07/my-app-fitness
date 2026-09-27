/**
 * Sinal de progressão — KORA_MASTER_CONTEXT.md seção 43.
 *
 * "A primeira versão não deve prometer prescrição perfeita." Por isso o sinal
 * só aparece depois de duas sessões consecutivas no topo da faixa de
 * repetições configurada, nunca depois de uma única sessão boa. É uma
 * sugestão de texto (seção 43 traz o próprio exemplo: "considere aumentar
 * ligeiramente a carga"), nunca uma reescrita automática de
 * `target_sets`/`min_reps`/`max_reps`.
 *
 * Função pura: sem rede, sem React. As sessões entram já filtradas para um
 * único exercício, da mais recente para a mais antiga.
 */

export type SessionSetSummary = {
  sessionId: string;
  sets: { reps: number; completed: boolean }[];
};

export type ProgressionSignal = 'increase_load';

/** Quantas sessões consecutivas no topo da faixa disparam o sinal. */
const CONSECUTIVE_SESSIONS = 2;

function hitTopOfRange(session: SessionSetSummary, maxReps: number): boolean {
  const completed = session.sets.filter((set) => set.completed);
  if (completed.length === 0) return false;
  return completed.every((set) => set.reps >= maxReps);
}

/**
 * `sessions` já vem ordenada da mais recente para a mais antiga. Devolve
 * `null` quando faltar histórico ou quando qualquer uma das duas últimas
 * sessões tiver ficado abaixo do topo da faixa — inclusive quando uma delas
 * não teve nenhuma série completa.
 */
export function progressionSignal(
  sessions: SessionSetSummary[],
  maxReps: number,
): ProgressionSignal | null {
  if (!Number.isFinite(maxReps) || maxReps <= 0) return null;
  if (sessions.length < CONSECUTIVE_SESSIONS) return null;
  const lastTwo = sessions.slice(0, CONSECUTIVE_SESSIONS);
  return lastTwo.every((session) => hitTopOfRange(session, maxReps)) ? 'increase_load' : null;
}
