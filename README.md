# KORA

Seu corpo. Seu plano. Todo dia.

Aplicativo mobile de fitness e bem-estar.

**O estado atual do projeto, as pendências e as regras que não podem ser quebradas estão em [STATUS.md](STATUS.md).** Comece por ele.

Fonte oficial de produto: [KORA_MASTER_CONTEXT.md](KORA_MASTER_CONTEXT.md). O escopo e as decisões de cada fase estão em [docs/PHASE_0.md](docs/PHASE_0.md), [docs/PHASE_1.md](docs/PHASE_1.md), [docs/PHASE_2.md](docs/PHASE_2.md) e [docs/PHASE_3.md](docs/PHASE_3.md).

## Estado atual

Fases 0 a 3 concluídas:

- **Fase 0 — fundação.** Expo + React Native + TypeScript, cinco abas, tema, componentes, tradução pt-BR e cliente Supabase sob demanda.
- **Fase 1 — autenticação.** Cadastro, login, sessão persistida, logout, recuperação de senha, proteção de rotas e perfil base. Tabelas com RLS.
- **Fase 2 — onboarding.** Fluxo de sete etapas com persistência de objetivo, dados, meta, atividade, treino e alimentação.
- **Fase 3 — Motor Fitness.** IMC, TMB, TDEE, calorias, macros e água, versionados e gravados em `nutrition_targets`.

Ainda não implementados: dashboard Hoje, registros diários, treinos, score, IA e assinaturas.

## Requisitos

- Node.js 24 LTS recomendado (Expo SDK 57 exige pelo menos Node 22.13 na linha 22).
- npm e dependências instaladas com `npm ci`.
- Cliente `psql` no PATH para aplicar migrations (`npm run migrate`).
- Expo Go compatível com SDK 57 em um dispositivo, ou ambiente de desenvolvimento nativo.
- O simulador iOS requer macOS. No Windows é possível gerar bundles iOS e testar em dispositivo compatível; isso não equivale a compilar um IPA.

## Executar

```sh
npm ci
npm run web
# Ou iniciar o Metro e usar o QR code no dispositivo:
npm start
```

Neste computador, o npm global possui um atalho quebrado e o Node do sistema é 22.4. O script abaixo usa uma instalação compatível disponível (incluindo o runtime local do Codex, quando presente), sem alterar a instalação global:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev.ps1 web
# Outras tarefas: start, android, ios, install, check, build:web, build:native
```

A versão web serve para revisão do app mobile. Landing page e painel administrativo Next.js continuam fora desta fase.

## Ambiente Supabase

Copie `.env.example` para `.env` e preencha. O arquivo tem duas partes:

- **Pública**, com prefixo `EXPO_PUBLIC_`: URL do projeto e chave **publishable**. Entra no bundle do app.
- **Privada**, sem o prefixo: senha e connection strings do Postgres, usadas só por ferramentas locais.

Nunca coloque `service_role`, `sb_secret_`, senhas ou chaves de IA em variáveis `EXPO_PUBLIC_*`: elas entram no bundle. A validação do cliente não remove segredos que já tenham sido inseridos no ambiente.

`getSupabaseClient()` retorna `null` se a configuração pública estiver ausente ou inválida; nesse caso o app continua navegável como prévia e as telas de conta exibem aviso. A persistência de sessão nativa usa AsyncStorage conforme o quickstart oficial; não é um cofre criptografado.

### Configuração pendente no Dashboard

Para o link do e-mail abrir o app, cadastre em **Authentication > URL Configuration** as URLs de redirecionamento `kora://sign-in`, `kora://reset-password` e as equivalentes da versão web. O remetente de e-mail padrão do Supabase tem limite baixo e precisa ser trocado por SMTP próprio antes do beta.

## Migrations

As migrations ficam em `supabase/migrations`, numeradas, e são aplicadas pelo `psql` local. O projeto não depende do CLI do Supabase.

```sh
npm run migrate:status   # lista o que já foi aplicado
npm run migrate          # aplica as pendentes, cada arquivo em uma transação
```

O controle do que já rodou fica em `kora_meta.schema_migrations`, no próprio banco. A conexão vem de `SUPABASE_DB_URL_SESSION` (session pooler, porta 5432); a senha vai por `PGPASSWORD`, nunca como argumento de processo.

Regra do projeto: **toda tabela de usuário nasce com RLS e com privilégios explícitos.** O Supabase concede `all privileges` no schema public por default privileges, e isso inclui `TRUNCATE`, que não passa por RLS. Cada migration revoga tudo e concede apenas os verbos que têm política correspondente.

Para conferir o isolamento depois de mexer em políticas:

```sh
psql -v ON_ERROR_STOP=1 -d "$SUPABASE_DB_URL_SESSION" -f scripts/rls-check.sql
```

O script cria dois usuários, testa o isolamento entre eles e termina com `ROLLBACK`: nada fica no banco.

## Comandos de validação

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run check
npm run build:web
npm run build:native
npm run migrate:status
```

`build:web` gera a exportação estática em `dist`. `build:native` gera bundles com o Metro, incluindo Android/iOS, em `dist-native`. Nenhum desses comandos gera um APK/IPA assinado ou publica o app. Credenciais, identificadores definitivos e EAS serão configurados quando necessário.

## Organização

```text
src/
  app/
    (auth)/            Entrar, criar conta, recuperar e trocar senha
    (onboarding)/      Fluxo de sete etapas
    (tabs)/            App autenticado
  components/          Primitivas visuais, formulário e seleção
  features/auth/       Provider de sessão, validação e mapa de erros
  features/onboarding/ Modelo, validação, payload e persistência
  features/fitness/    Motor Fitness: constantes, fórmulas e metas
  features/dashboard/  Tela inicial
  lib/i18n/            Catálogo pt-BR e tipos de tradução
  lib/rounding.ts      Arredondamentos centralizados
  lib/env.ts           Configuração pública validada
  services/supabase/   Cliente sob demanda e tipos do banco
  theme/               Tokens de tema
supabase/migrations/   SQL numerado, aplicado por npm run migrate
scripts/               Execução local, migrations e verificação de RLS
```

Cada grupo de rotas declara sua própria regra de acesso no `_layout.tsx`: sem sessão vai para `/sign-in`, com sessão e onboarding pendente vai para `/onboarding`.

Novas features devem ser autocontidas, com lógica de negócio fora dos componentes. Não são criadas pastas vazias nem stores sem uso. O tema inicial é claro; traduções en-US/es e preferências editáveis serão adicionadas conforme necessário.

## Motor Fitness

Todos os cálculos vivem em `src/features/fitness/engine.ts`, como funções puras testadas uma a uma. Os parâmetros ajustáveis ficam em `constants.ts`.

**Ao alterar qualquer constante, suba `FITNESS_ENGINE_VERSION`.** Cada meta gravada guarda a versão que a produziu, em `nutrition_targets.calculation_source`, e metas antigas não são recalculadas retroativamente. Sem isso, não há como saber com que regra uma meta antiga foi feita.

Nunca duplique um cálculo fora desse módulo: a interface apenas exibe o que `buildFitnessPlan` devolveu.

## Próxima etapa

Fase 4 — Dashboard Hoje: componentes da home, prioridades diárias e motor de prioridades. O documento mestre original foi preservado; o estado atual fica em [STATUS.md](STATUS.md) e o detalhe de cada fase em `docs/`.

## Referências técnicas

- [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Expo Router custom tabs](https://docs.expo.dev/router/advanced/custom-tabs/)
- [Supabase com React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native)
