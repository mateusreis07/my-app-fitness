## Read this first

**Before anything else, read `STATUS.md` at the repository root.** It is the project's single source of truth for what exists today, what is pending, which decisions are awaiting the owner's confirmation, and which invariants must not be broken.

**At the end of every implementation, update `STATUS.md`** following the checklist in its final section. A change is not finished until that file reflects it.

Document hierarchy: `KORA_MASTER_CONTEXT.md` (product, never reformat) → `STATUS.md` (current state) → `docs/PHASE_N.md` (per-phase detail) → this file (technical rules).

---

This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## KORA product scope

Read `KORA_MASTER_CONTEXT.md` and the phase docs in `docs/` before changing product behavior. Follow the phases defined in the master document. Keep UI strings in `src/lib/i18n/pt-BR.ts`, business rules outside UI, and private credentials outside client bundles. Run `npm run check` and the relevant Expo export before delivering changes. Do not reformat the original master context automatically.

## Database

Migrations live in `supabase/migrations`, numbered, applied with `npm run migrate` (uses the local `psql`, not the Supabase CLI). Never edit an applied migration — add a new one.

Every user table must ship with RLS enabled, a policy per verb, and **explicit privileges**. Supabase grants `all privileges` on the public schema to `anon` and `authenticated` by default, which includes `TRUNCATE` — and `TRUNCATE` bypasses RLS. So each migration must `revoke all ... from anon, authenticated` and then grant only the verbs that have a matching policy. After touching policies, run `scripts/rls-check.sql`.

Keep `src/services/supabase/database.types.ts` in sync with the migrations in the same change; those types are hand-written, not generated.

## Fitness Engine

All health calculations live in `src/features/fitness/engine.ts` as pure functions. Tunable parameters live in `constants.ts`. Never duplicate a calculation elsewhere — the UI only renders what `buildFitnessPlan` returned.

**Changing any constant requires bumping `FITNESS_ENGINE_VERSION`.** Every saved target records the version that produced it (`nutrition_targets.calculation_source`), and old targets are never recalculated retroactively. Rounding goes through `src/lib/rounding.ts`, never inline.
