# Fase 1 — Autenticação

Fonte de produto: `KORA_MASTER_CONTEXT.md`, seções 61, 81, 82, 83, 84 e 2136 (roadmap).

## Escopo

Cadastro, login, sessão persistida, logout, recuperação de senha, proteção de rotas e perfil base. Primeira fase com infraestrutura remota: o projeto Supabase passa a existir e as tabelas nascem com RLS.

## Decisões reversíveis

- `profiles` segue o modelo do documento mestre com `id` e `user_id` separados. `user_id` é único e referencia `auth.users`, o que mantém o mesmo nome de coluna para RLS em todas as tabelas.
- O perfil é criado por trigger (`on_auth_user_created`) no cadastro, com `display_name` vindo do metadata do usuário. O app não depende disso: o onboarding faz upsert.
- Sem política de `DELETE` em `profiles`. Exclusão de conta é item de LGPD (seção 84) e precisa remover o usuário em `auth.users`, o que exige rotina de servidor.
- Política de senha do cliente mais estrita que a do Supabase: mínimo de 8 caracteres com letras e números.
- Mensagens de erro do servidor nunca são exibidas. `mapAuthError` converte código em texto do catálogo pt-BR.
- Recuperação de senha responde igual para e-mail existente e inexistente, para não revelar quem tem conta.
- Proteção de rotas por `<Redirect>` no layout de cada grupo, não por `Stack.Protected`. Cada grupo declara sua própria regra e o destino do desvio é explícito.
- Sem backend configurado, o app continua navegável como prévia da Fase 0, e as telas de conta exibem aviso em vez de formulário.
- Migrations aplicadas por `scripts/migrate.mjs` sobre o `psql` local, sem adicionar o CLI do Supabase como dependência. O controle fica em `kora_meta.schema_migrations`.

## Critérios de aceite

- [x] Cadastro, login, logout, recuperação e troca de senha implementados.
- [x] Sessão persistida (AsyncStorage no nativo) com refresh automático apenas em primeiro plano.
- [x] Rotas protegidas: sem sessão vai para `/sign-in`; com sessão e onboarding pendente vai para `/onboarding`.
- [x] Perfil base criado no cadastro e exibido na aba Perfil.
- [x] Migrations com RLS aplicadas e isolamento verificado com dois usuários.
- [x] TypeScript, ESLint, Prettier e testes passam. Export Android/iOS/web gerado.

## Migrations

- `0001_auth_profiles.sql` — enums `biological_sex`, `activity_level`, `fitness_experience`; tabela `profiles`; funções `set_updated_at` e `handle_new_user`; trigger em `auth.users`; RLS com select/insert/update do próprio registro.
- `0002_privilege_hardening.sql` — correção de segurança. O Supabase concede `all privileges` no schema public para `anon` e `authenticated` por default privileges, e isso inclui `TRUNCATE`, que **não** passa por RLS: qualquer usuário logado poderia esvaziar a tabela mesmo com as políticas corretas. A migration revoga tudo, concede apenas os verbos com política correspondente e desliga as default privileges para tabelas futuras.

## Testes

- `src/features/auth/validation.test.mts` — 6 testes: normalização de e-mail, formato de e-mail, política de senha, presença no login, confirmação e nome.
- `src/features/auth/errors.test.mts` — 4 testes: códigos conhecidos, HTTP 429, falha de rede sem código, e fallback que não vaza texto do servidor.
- `scripts/rls-check.sql` — isolamento por RLS com dois usuários, dentro de transação revertida.

## Validação executada

- `npm run check`: TypeScript, ESLint e Prettier sem erros; 34 testes aprovados.
- `npm run build:native`: bundles Hermes Android/iOS e 23 rotas web exportadas.
- `scripts/rls-check.sql` contra o projeto real: perfil criado pelo trigger; cada usuário enxerga apenas a própria linha; update na linha alheia não afeta nada; insert em nome de outro usuário bloqueado; `TRUNCATE` e `DELETE` em `profiles` negados por falta de privilégio.
- Teste ponta a ponta pela API REST com a chave publishable e um usuário confirmado: login `200`, insert próprio `201`, insert em nome de outro `403`, select retornando apenas as próprias linhas, delete sem política `403`. O usuário de teste foi removido; o banco ficou com zero linhas.
- Configuração de autenticação lida do projeto em 22/09/2026: `mailer_autoconfirm: true` e `disable_signup: false`. A confirmação por e-mail foi desativada pelo dono do projeto, então o cadastro devolve sessão imediata e o app segue direto para o onboarding. As URLs de redirecionamento foram cadastradas no Dashboard.
- Cadastro e logout verificados contra o projeto real pela API, com a chave publishable: `signup` devolve `access_token`, o trigger cria o perfil com o `display_name` do metadata, e `logout` responde `204`.

## Limites conhecidos

- A sessão nativa usa AsyncStorage, que não é criptografado. Migrar os tokens para `expo-secure-store` é uma decisão pendente.
- O remetente de e-mail padrão do Supabase tem limite baixo e não serve para produção. Um provedor SMTP próprio precisa ser configurado antes do beta. Com `mailer_autoconfirm` ligado isso não afeta o cadastro, mas afeta a recuperação de senha, que continua dependendo de e-mail.
- O fluxo de recuperação de senha não foi percorrido ponta a ponta: depende do envio real do e-mail.

## Próxima fase

Fase 2 — onboarding. Ver `docs/PHASE_2.md`.
