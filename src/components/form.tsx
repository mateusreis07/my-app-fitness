import Feather from '@expo/vector-icons/Feather';
import { Link, type Href } from 'expo-router';
import { useId } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { Copy, type IconName } from '@/components/ui';
import { theme } from '@/theme/tokens';

export function Field({
  label,
  error,
  hint,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <View style={s.field}>
      <Text nativeID={`${id}-label`} style={s.label}>
        {label}
      </Text>
      {hint ? (
        <Copy nativeID={`${id}-hint`} style={s.hint}>
          {hint}
        </Copy>
      ) : null}
      <TextInput
        {...props}
        accessibilityLabel={label}
        aria-labelledby={`${id}-label`}
        aria-describedby={describedBy || undefined}
        aria-invalid={Boolean(error)}
        placeholderTextColor={theme.colors.muted}
        style={[s.input, Boolean(error) && s.inputError, props.style]}
      />
      {error ? (
        <Copy nativeID={`${id}-error`} role="alert" style={s.error}>
          {error}
        </Copy>
      ) : null}
    </View>
  );
}

export function ActionButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = 'primary',
  icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'quiet';
  icon?: IconName;
}) {
  const blocked = disabled || loading;
  const quiet = tone === 'quiet';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        quiet && s.quietButton,
        blocked && s.buttonBlocked,
        pressed && !blocked && s.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={quiet ? theme.colors.primary : theme.colors.onPrimary}
        />
      ) : null}
      <Copy style={[s.buttonText, quiet && s.quietButtonText]}>{label}</Copy>
      {icon && !loading ? (
        <Feather
          accessible={false}
          aria-hidden
          name={icon}
          size={18}
          color={quiet ? theme.colors.primary : theme.colors.onPrimary}
        />
      ) : null}
    </Pressable>
  );
}

const NOTICE_ICON: Record<'info' | 'error' | 'success', IconName> = {
  info: 'info',
  error: 'alert-circle',
  success: 'check-circle',
};

export function FormNotice({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success';
  children: string;
}) {
  return (
    <View role="alert" style={[s.notice, tone === 'error' && s.noticeError]}>
      <Feather
        accessible={false}
        aria-hidden
        name={NOTICE_ICON[tone]}
        size={17}
        color={tone === 'error' ? theme.colors.warm : theme.colors.primary}
      />
      <Copy style={s.noticeText}>{children}</Copy>
    </View>
  );
}

export function TextLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={s.textLink}>
        <Copy style={s.textLinkLabel}>{label}</Copy>
      </Pressable>
    </Link>
  );
}

const s = StyleSheet.create({
  field: { gap: 6 },
  label: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  hint: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
    color: theme.colors.ink,
    fontSize: 15,
  },
  inputError: { borderColor: theme.colors.warm },
  error: { color: theme.colors.warm, fontSize: 12, lineHeight: 18 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 20,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary,
  },
  quietButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  buttonBlocked: { opacity: 0.55 },
  pressed: { opacity: 0.75 },
  buttonText: { color: theme.colors.onPrimary, fontWeight: '700', fontSize: 15 },
  quietButtonText: { color: theme.colors.primary },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primarySoft,
  },
  noticeError: { backgroundColor: theme.colors.warmSoft },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 20 },
  textLink: { minHeight: 44, justifyContent: 'center' },
  textLinkLabel: { color: theme.colors.primary, fontWeight: '700', fontSize: 13 },
});
