/**
 * Único lugar do projeto que importa `expo-notifications`. Só notificação
 * local: nenhuma das quatro (água/treino/peso/resumo) depende de servidor —
 * todo dado já está no cliente.
 *
 * **Import dinâmico, nunca estático.** Bug conhecido do Expo Go a partir do
 * SDK 53/57 no Android: o simples `import` de `expo-notifications` no topo do
 * arquivo já derruba o app inteiro no Expo Go — o módulo lança uma exceção na
 * inicialização checando suporte a push remoto, mesmo quando o app só usa
 * notificação local. A correção documentada da própria comunidade Expo é
 * carregar o módulo só sob demanda, e nunca dentro do Expo Go. Confirmado ao
 * vivo num Android real via depuração USB (ver `docs/PHASE_10.md`).
 *
 * Sem suporte no Expo Go nem na web: os quatro lembretes ficam desativados
 * nesses ambientes, sem lançar nem travar o app. Funcionará normalmente
 * assim que o projeto tiver um development build (fora do escopo desta fase —
 * o projeto não tem `eas.json`/build nativo ainda).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const SUPPORTED =
  Platform.OS !== 'web' &&
  Constants.executionEnvironment !== Constants.ExecutionEnvironment.StoreClient;

let handlerConfigured = false;

async function loadNotifications() {
  if (!SUPPORTED) return null;
  return import('expo-notifications');
}

/** Notificação aparece com o app em primeiro plano. Chamar uma vez, na raiz. */
export async function configureNotificationHandler() {
  if (handlerConfigured) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermission(): Promise<PermissionState> {
  const Notifications = await loadNotifications();
  if (!Notifications) return 'unsupported';
  const result = await Notifications.getPermissionsAsync();
  return result.granted ? 'granted' : result.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  const Notifications = await loadNotifications();
  if (!Notifications) return 'unsupported';
  const result = await Notifications.requestPermissionsAsync();
  return result.granted ? 'granted' : result.canAskAgain ? 'undetermined' : 'denied';
}

export type NotificationEntry = { id: string; secondsFromNow: number; title: string; body: string };

/**
 * Cancela o id antes de agendar de novo — o mesmo identificador nunca
 * duplica, esteja ele agendado ou não (cancelar um id inexistente não é erro).
 */
export async function applyPlan(entries: NotificationEntry[], cancelIds: string[]) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  for (const id of cancelIds) await Notifications.cancelScheduledNotificationAsync(id);
  for (const entry of entries) {
    await Notifications.cancelScheduledNotificationAsync(entry.id);
    await Notifications.scheduleNotificationAsync({
      identifier: entry.id,
      content: { title: entry.title, body: entry.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(entry.secondsFromNow)),
      },
    });
  }
}

export async function cancelNotification(id: string) {
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.cancelScheduledNotificationAsync(id);
}
