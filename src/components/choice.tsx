import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Copy } from '@/components/ui';
import { theme } from '@/theme/tokens';

function GroupShell({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={s.group} accessibilityRole="radiogroup">
      <Text style={s.label}>{label}</Text>
      {hint ? <Copy style={s.hint}>{hint}</Copy> : null}
      {children}
      {error ? (
        <Copy role="alert" style={s.error}>
          {error}
        </Copy>
      ) : null}
    </View>
  );
}

/** Escolha única, empilhada. Cada opção pode trazer uma linha de apoio. */
export function ChoiceGroup<T extends string | number>({
  label,
  hint,
  error,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  options: { value: T; label: string; description?: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <GroupShell label={label} hint={hint} error={error}>
      <View style={s.stack}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [
                s.choice,
                selected && s.choiceSelected,
                pressed && s.pressed,
              ]}
            >
              <View style={[s.radio, selected && s.radioSelected]}>
                {selected ? <View style={s.radioDot} /> : null}
              </View>
              <View style={s.choiceCopy}>
                <Copy style={[s.choiceLabel, selected && s.choiceLabelSelected]}>
                  {option.label}
                </Copy>
                {option.description ? (
                  <Copy style={s.choiceDescription}>{option.description}</Copy>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </GroupShell>
  );
}

/** Escolha única compacta, em linha, para números e listas curtas. */
export function PillGroup<T extends string | number>({
  label,
  hint,
  error,
  options,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <GroupShell label={label} hint={hint} error={error}>
      <View style={s.row}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={String(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => [s.pill, selected && s.pillSelected, pressed && s.pressed]}
            >
              <Copy style={[s.pillLabel, selected && s.pillLabelSelected]}>{option.label}</Copy>
            </Pressable>
          );
        })}
      </View>
    </GroupShell>
  );
}

/** Múltipla escolha. Cada item é uma caixa independente. */
export function ChipGroup({
  label,
  hint,
  options,
  values,
  onToggle,
}: {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  values: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <View style={s.group}>
      <Text style={s.label}>{label}</Text>
      {hint ? <Copy style={s.hint}>{hint}</Copy> : null}
      <View style={s.row}>
        {options.map((option) => {
          const checked = values.includes(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              onPress={() => onToggle(option.value)}
              style={({ pressed }) => [s.pill, checked && s.pillSelected, pressed && s.pressed]}
            >
              {checked ? (
                <Feather
                  accessible={false}
                  aria-hidden
                  name="check"
                  size={14}
                  color={theme.colors.primary}
                />
              ) : null}
              <Copy style={[s.pillLabel, checked && s.pillLabelSelected]}>{option.label}</Copy>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [s.switchRow, pressed && s.pressed]}
    >
      <Copy style={s.switchLabel}>{label}</Copy>
      <View style={[s.switchTrack, value && s.switchTrackOn]}>
        <View style={[s.switchThumb, value && s.switchThumbOn]} />
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  group: { gap: 8 },
  label: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  hint: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  error: { color: theme.colors.warm, fontSize: 12, lineHeight: 18 },
  stack: { gap: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    minHeight: 52,
    padding: 14,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  choiceSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  choiceCopy: { flex: 1, gap: 2 },
  choiceLabel: { fontSize: 15 },
  choiceLabelSelected: { fontWeight: '700', color: theme.colors.primary },
  choiceDescription: { color: theme.colors.muted, fontSize: 12, lineHeight: 18 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioSelected: { borderColor: theme.colors.primary },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.line,
    backgroundColor: theme.colors.surface,
  },
  pillSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  pillLabel: { fontSize: 14 },
  pillLabelSelected: { fontWeight: '700', color: theme.colors.primary },
  pressed: { opacity: 0.7 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    minHeight: 48,
  },
  switchLabel: { flex: 1, fontSize: 15 },
  switchTrack: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 3,
    backgroundColor: theme.colors.line,
    justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: theme.colors.primary },
  switchThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.surface,
  },
  switchThumbOn: { alignSelf: 'flex-end' },
});
