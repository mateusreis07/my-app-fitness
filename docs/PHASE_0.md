# Fase 0 — Fundação

Fonte de produto: `KORA_MASTER_CONTEXT.md`, especialmente seções 85–93, 104–107 e 131–138.

## Escopo

Aplicativo mobile com Expo, React Native, TypeScript e Expo Router. A versão web do mesmo app serve apenas para desenvolvimento e revisão; não substitui a futura landing page em Next.js.

Esta fase prepara tema, componentes básicos, navegação, tradução pt-BR, configuração pública e cliente Supabase. As telas usam estados vazios explícitos. Não existem dados fictícios apresentados como reais, cálculos, autenticação funcional, registros ou cobrança.

## Decisões reversíveis

- Um único aplicativo na raiz, sem monorepo ou projeto Next.js antecipado.
- Cinco abas: Hoje, Alimentação, Treino, Progresso e Perfil.
- Tema inicial claro, verde profundo, superfícies neutras e detalhes em lima. Tokens centralizados permitem evoluir o visual.
- Textos em catálogo pt-BR com i18next, preparado para outros idiomas. Sem traduções automáticas incompletas.
- Cliente Supabase criado sob demanda. Sem variáveis de ambiente, a navegação funciona e nenhuma conexão é tentada.
- Somente URL e chave pública do Supabase no bundle. Persistência de sessão em armazenamento local do dispositivo; fluxo de autenticação será implementado na Fase 1.
- Nenhuma tabela ou migration nesta fase; tabelas de usuário deverão nascer com RLS e testes de isolamento na fase correspondente.
- Nenhuma biblioteca de estado global antes de existir necessidade concreta.

## Critérios de aceite

- [x] Dependências instaladas; versões conferidas contra a matriz local do SDK 57.
- [x] TypeScript, lint, formatter e 5 testes de configuração passam.
- [x] Exportação web estática e bundles Hermes Android/iOS gerados.
- [x] Cinco abas, estados vazios, seleção acessível e página Sobre revisados no navegador, incluindo viewport de 390 × 844.
- [x] Documentação de execução, ambiente e script auxiliar para Windows disponíveis.

## Próxima fase

Fase 1 — autenticação: cadastro, login, sessão, logout, recuperação, proteção de rotas e perfil base. Exige um projeto Supabase configurado e migrations com RLS. Onboarding pertence à Fase 2; Fitness Engine, à Fase 3.

## Validação e limites

- Implementação da fundação concluída em 22/09/2026 (UTC).
- `npm run check`: TypeScript e ESLint sem erros; Prettier aprovado; 5 testes aprovados para configuração ausente, válida, parcial, privada e endpoints inseguros/locais.
- `expo export --platform all --output-dir dist-native`: bundles Android/iOS Hermes e HTML/JavaScript web. Não equivale a compilar APK/IPA nem testar em dispositivo físico.
- Navegação por Hoje, Alimentação, Treino, Progresso e Perfil conferida no navegador. Links Sobre e retorno ao início conferidos. A seleção das abas é anunciada por acessibilidade; ícones decorativos não compõem o nome dos controles.
- Testes de integração Supabase não se aplicam ainda: não há projeto remoto configurado nem tabelas nesta fase. Login e dados persistidos exigem a Fase 1 e seguintes.
- O runtime de testes Node emite aviso sobre detecção automática de ES Modules em `env.ts`; os testes passam. O app é compilado pelo Metro.
- Auditoria inicial: 14 alertas moderados transitivos, ligados a `uuid`/`xcode` e `decode-uri-component`/`query-string` na árvore do Expo. Nenhum alerta alto ou crítico. O npm sugere downgrades incompatíveis do Expo/Router; não foi usado `audit fix --force`. Reavaliar atualizações compatíveis antes do beta e da publicação. Relatório local: `.npm-cache/audit.json` (ignorado no versionamento).
- A validação de versões usou o modo offline e a matriz de dependências distribuída com o SDK. Um build assinado em dispositivo ainda precisará de validação própria.

## Migrations

Nenhuma. Não houve criação ou alteração de infraestrutura remota.
