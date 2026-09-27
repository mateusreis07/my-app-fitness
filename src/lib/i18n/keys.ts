import type { ptBR } from './pt-BR';

/**
 * Todas as chaves do catálogo em notação de ponto, derivadas do próprio
 * catálogo. Permite que módulos de regra (validação, mapeamento de erro,
 * listas de opções) devolvam uma chave de tradução com verificação de tipo,
 * em vez de um `string` solto que o `t()` tipado recusaria.
 */
type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type TranslationKey = Leaves<typeof ptBR>;
