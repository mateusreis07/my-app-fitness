// Aplica as migrations de supabase/migrations no banco do projeto.
//
//   node scripts/migrate.mjs           aplica as pendentes
//   node scripts/migrate.mjs --status  apenas lista o que falta
//
// Usa o psql instalado localmente para não adicionar dependência de runtime ao
// aplicativo. A senha vai por PGPASSWORD, nunca como argumento de processo.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = join(root, 'supabase', 'migrations');

function loadEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) throw new Error('Arquivo .env não encontrado. Copie .env.example.');
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

function findPsql() {
  const probe = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['psql'], {
    encoding: 'utf8',
  });
  if (probe.status === 0) {
    const found = probe.stdout.split(/\r?\n/).find(Boolean);
    if (found) return found.trim();
  }
  const guesses = [];
  for (const major of [18, 17, 16, 15, 14]) {
    guesses.push(`C:/Program Files/PostgreSQL/${major}/bin/psql.exe`);
  }
  const hit = guesses.find((candidate) => existsSync(candidate));
  if (hit) return hit;
  throw new Error('psql não encontrado. Instale o PostgreSQL client ou adicione psql ao PATH.');
}

const env = loadEnv();
const rawUrl = env.SUPABASE_DB_URL_SESSION;
if (!rawUrl)
  throw new Error('Defina SUPABASE_DB_URL_SESSION no .env (session pooler, porta 5432).');

const parsed = new URL(rawUrl);
const password = decodeURIComponent(parsed.password);
parsed.password = '';
const connection = parsed.toString();
const psql = findPsql();

function run(args, { input } = {}) {
  const result = spawnSync(psql, ['-v', 'ON_ERROR_STOP=1', '-d', connection, ...args], {
    encoding: 'utf8',
    input,
    env: { ...process.env, PGPASSWORD: password },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`psql falhou (${result.status}):\n${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

run(['-q', '-c', 'create schema if not exists kora_meta']);
run([
  '-q',
  '-c',
  `create table if not exists kora_meta.schema_migrations (
     version text primary key,
     applied_at timestamptz not null default now()
   )`,
]);

const applied = new Set(
  run(['-tA', '-c', 'select version from kora_meta.schema_migrations'])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean),
);

const all = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const pending = all.filter((name) => !applied.has(name));

if (process.argv.includes('--status')) {
  for (const name of all) console.log(`${applied.has(name) ? 'aplicada ' : 'pendente '} ${name}`);
  process.exit(0);
}

if (pending.length === 0) {
  console.log('Nenhuma migration pendente.');
  process.exit(0);
}

for (const name of pending) {
  process.stdout.write(`aplicando ${name} ... `);
  const sql = readFileSync(join(migrationsDir, name), 'utf8');
  // -1 envolve o arquivo inteiro em uma transação: ou aplica tudo, ou nada.
  run(['-1', '-q', '-f', '-'], { input: sql });
  run([
    '-q',
    '-c',
    `insert into kora_meta.schema_migrations (version) values ('${name.replace(/'/g, "''")}')`,
  ]);
  console.log('ok');
}
console.log(`${pending.length} migration(s) aplicada(s).`);
