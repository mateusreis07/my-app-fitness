// Preenche o catálogo global de exercícios com referências comuns, para
// exercitar a construção de plano e a sessão enquanto uma base licenciada não
// é decidida.
//
//   node scripts/seed-exercises.mjs            insere (idempotente pelo nome)
//   node scripts/seed-exercises.mjs --remove   apaga tudo que tem source='seed'
//   node scripts/seed-exercises.mjs --status   conta o que está lá
//
// ATENÇÃO: descrições e instruções são resumos de conhecimento público,
// escritos à mão para teste. Não vieram de base licenciada. Todos entram com
// `source='seed'` e `verified=false`, e precisam ser substituídos por uma
// fonte verificada antes do beta.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** [nome, músculo primário, músculos secundários, equipamento] */
const EXERCISES = [
  ['Supino reto com barra', 'Peito', ['Tríceps', 'Ombro'], 'Barra'],
  ['Supino inclinado com halteres', 'Peito', ['Tríceps', 'Ombro'], 'Halteres'],
  ['Crucifixo com halteres', 'Peito', [], 'Halteres'],
  ['Flexão de braço', 'Peito', ['Tríceps', 'Ombro'], 'Peso do corpo'],
  ['Puxada frontal', 'Costas', ['Bíceps'], 'Máquina'],
  ['Remada curvada com barra', 'Costas', ['Bíceps'], 'Barra'],
  ['Remada unilateral com halter', 'Costas', ['Bíceps'], 'Halteres'],
  ['Barra fixa', 'Costas', ['Bíceps'], 'Peso do corpo'],
  ['Desenvolvimento com halteres', 'Ombro', ['Tríceps'], 'Halteres'],
  ['Elevação lateral', 'Ombro', [], 'Halteres'],
  ['Elevação frontal', 'Ombro', [], 'Halteres'],
  ['Rosca direta com barra', 'Bíceps', ['Antebraço'], 'Barra'],
  ['Rosca alternada com halteres', 'Bíceps', ['Antebraço'], 'Halteres'],
  ['Tríceps corda na polia', 'Tríceps', [], 'Cabo'],
  ['Tríceps testa com barra', 'Tríceps', [], 'Barra'],
  ['Agachamento livre', 'Quadríceps', ['Glúteo', 'Posterior de coxa'], 'Barra'],
  ['Leg press', 'Quadríceps', ['Glúteo'], 'Máquina'],
  ['Afundo com halteres', 'Quadríceps', ['Glúteo'], 'Halteres'],
  ['Cadeira extensora', 'Quadríceps', [], 'Máquina'],
  ['Mesa flexora', 'Posterior de coxa', [], 'Máquina'],
  ['Levantamento terra romeno', 'Posterior de coxa', ['Glúteo', 'Costas'], 'Barra'],
  ['Elevação pélvica', 'Glúteo', ['Posterior de coxa'], 'Barra'],
  ['Elevação de panturrilha em pé', 'Panturrilha', [], 'Máquina'],
  ['Prancha abdominal', 'Core', [], 'Peso do corpo'],
  ['Abdominal supra', 'Core', [], 'Peso do corpo'],
];

function loadEnv() {
  const file = join(root, '.env');
  if (!existsSync(file)) throw new Error('Arquivo .env não encontrado.');
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
  for (const major of [18, 17, 16, 15, 14]) {
    const guess = `C:/Program Files/PostgreSQL/${major}/bin/psql.exe`;
    if (existsSync(guess)) return guess;
  }
  throw new Error('psql não encontrado.');
}

const env = loadEnv();
const parsed = new URL(env.SUPABASE_DB_URL_SESSION);
const password = decodeURIComponent(parsed.password);
parsed.password = '';
const connection = parsed.toString();
const psql = findPsql();

// O SQL vai por stdin: passar acento na linha de comando corrompe o texto,
// porque o console do Windows não usa UTF-8.
function run(sql, extra = []) {
  const result = spawnSync(psql, ['-v', 'ON_ERROR_STOP=1', '-d', connection, ...extra, '-f', '-'], {
    encoding: 'utf8',
    input: sql,
    env: { ...process.env, PGPASSWORD: password, PGCLIENTENCODING: 'UTF8' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return result.stdout.trim();
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const quoteArray = (values) => `array[${values.map(quote).join(', ')}]::text[]`;

if (process.argv.includes('--status')) {
  console.log(run('select source, count(*) from public.exercises group by source order by source'));
  process.exit(0);
}

if (process.argv.includes('--remove')) {
  run("delete from public.exercises where source = 'seed'");
  console.log('removidos os exercícios de teste (source = seed).');
  console.log(run('select count(*) as restantes from public.exercises'));
  process.exit(0);
}

// Idempotente: o mesmo nome não entra duas vezes.
const values = EXERCISES.map(
  ([name, muscle, secondary, equipment]) =>
    `(${quote(name)}, ${quote(muscle)}, ${quoteArray(secondary)}, ${quote(equipment)}, 'seed', false)`,
).join(',\n  ');

run(`
  insert into public.exercises
    (name, primary_muscle, secondary_muscles, equipment, source, verified)
  select v.name, v.primary_muscle, v.secondary_muscles, v.equipment,
         v.source::public.exercise_source, v.verified
  from (values
  ${values}
  ) as v(name, primary_muscle, secondary_muscles, equipment, source, verified)
  where not exists (
    select 1 from public.exercises e where lower(e.name) = lower(v.name)
  );
`);

console.log(`${EXERCISES.length} exercícios de referência processados.`);
console.log(run('select source, count(*) from public.exercises group by source order by source'));
