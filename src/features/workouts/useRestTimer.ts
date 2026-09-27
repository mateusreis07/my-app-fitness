import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { REST_NOTIFICATION_ID } from '@/features/notifications/model';
import { applyPlan, cancelNotification } from '@/features/notifications/scheduler';

const TICK_MS = 250;
export const ADD_SECONDS = 15;

/**
 * Cronômetro de descanso — seção 44. Guarda o **instante de término**
 * (`endsAt`) e deriva `remaining` a partir do relógio só dentro do
 * `setInterval`, nunca durante a renderização — `Date.now()` no corpo do
 * componente quebraria a pureza exigida pelo React Compiler. Por isso o
 * mesmo cálculo também roda em `start`/`addSeconds`, para o número aparecer
 * na hora, sem esperar o primeiro tick.
 *
 * Guardar o instante de término, não uma contagem isolada, também é o que
 * mantém o tempo restante correto se o app for para segundo plano e voltar.
 *
 * Vibra ao chegar a zero em primeiro plano; agenda também uma notificação
 * local (`kora-rest`) para o caso de o app estar em segundo plano — fecha a
 * seção 44, adiado desde a Fase 8 (ver `docs/PHASE_10.md`).
 */
export function useRestTimer() {
  const { t } = useTranslation();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const notified = useRef(false);

  useEffect(() => {
    if (endsAt === null) return;
    notified.current = false;
    const timer = setInterval(() => {
      setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt !== null && remaining === 0 && !notified.current) {
      notified.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Já terminou em primeiro plano: a notificação agendada não faz sentido mais.
      void cancelNotification(REST_NOTIFICATION_ID);
    }
  }, [endsAt, remaining]);

  function scheduleRestNotification(seconds: number) {
    void applyPlan(
      [
        {
          id: REST_NOTIFICATION_ID,
          secondsFromNow: seconds,
          title: t('workouts.session.restNotificationTitle'),
          body: t('workouts.session.restNotificationBody'),
        },
      ],
      [],
    );
  }

  return {
    remaining,
    running: endsAt !== null,
    start: (seconds: number) => {
      setEndsAt(Date.now() + seconds * 1000);
      setRemaining(seconds);
      scheduleRestNotification(seconds);
    },
    addSeconds: (seconds: number) => {
      const base = endsAt ?? Date.now();
      const next = base + seconds * 1000;
      setEndsAt(next);
      const remainingSeconds = Math.max(0, Math.ceil((next - Date.now()) / 1000));
      setRemaining(remainingSeconds);
      scheduleRestNotification(remainingSeconds);
    },
    skip: () => {
      setEndsAt(null);
      setRemaining(0);
      void cancelNotification(REST_NOTIFICATION_ID);
    },
  };
}
