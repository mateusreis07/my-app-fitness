// Preenche a base global com alimentos de referência, para exercitar busca e
// registro enquanto a fonte definitiva não é decidida.
//
//   node scripts/seed-foods.mjs            insere (idempotente pelo nome)
//   node scripts/seed-foods.mjs --remove   apaga tudo que tem source='seed'
//   node scripts/seed-foods.mjs --status   conta o que está lá
//
// ATENÇÃO: estes valores são APROXIMAÇÕES de conhecimento público, escritas à
// mão para teste. Não vieram de TACO, TBCA, Open Food Facts nem de qualquer
// base licenciada. Todos entram com `source='seed'` e `verified=false`, e
// precisam ser substituídos por uma fonte verificada antes do beta.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Valores por 100 g, ou por 100 ml quando a unidade é ml. */
const FOODS = [
  // Básicos do prato brasileiro
  ['Arroz branco cozido', 100, 'g', 128, 2.5, 28.1, 0.2],
  ['Arroz integral cozido', 100, 'g', 124, 2.6, 25.8, 1.0],
  ['Feijão carioca cozido', 100, 'g', 76, 4.8, 13.6, 0.5],
  ['Feijão preto cozido', 100, 'g', 77, 4.5, 14.0, 0.5],
  ['Macarrão cozido', 100, 'g', 158, 5.8, 30.9, 0.9],
  ['Batata inglesa cozida', 100, 'g', 52, 1.2, 11.9, 0.1],
  ['Mandioca cozida', 100, 'g', 125, 0.6, 30.1, 0.3],
  ['Farofa de mandioca', 100, 'g', 405, 2.0, 60.0, 17.0],

  // Proteínas
  ['Peito de frango grelhado', 100, 'g', 159, 32.0, 0.0, 2.5],
  ['Coxa de frango assada', 100, 'g', 215, 28.0, 0.0, 11.0],
  ['Patinho bovino grelhado', 100, 'g', 219, 35.9, 0.0, 7.3],
  ['Contrafilé grelhado', 100, 'g', 278, 32.0, 0.0, 16.0],
  ['Ovo de galinha cozido', 100, 'g', 146, 13.3, 0.6, 9.5],
  ['Tilápia grelhada', 100, 'g', 128, 26.0, 0.0, 2.7],
  ['Sardinha em conserva', 100, 'g', 208, 24.0, 0.0, 12.0],
  ['Carne de porco (lombo) assada', 100, 'g', 210, 32.0, 0.0, 8.5],

  // Laticínios
  ['Leite integral', 100, 'ml', 61, 2.9, 4.3, 3.2],
  ['Leite desnatado', 100, 'ml', 35, 3.4, 5.0, 0.2],
  ['Iogurte natural integral', 100, 'g', 61, 3.5, 4.7, 3.3],
  ['Queijo minas frescal', 100, 'g', 264, 17.4, 3.2, 20.2],
  ['Queijo mussarela', 100, 'g', 330, 22.0, 3.0, 25.0],
  ['Requeijão cremoso', 100, 'g', 257, 9.6, 3.0, 22.0],

  // Pães e cereais
  ['Pão francês', 100, 'g', 300, 8.0, 58.6, 3.1],
  ['Pão de forma integral', 100, 'g', 253, 9.4, 43.9, 3.9],
  ['Tapioca (goma hidratada)', 100, 'g', 240, 0.0, 60.0, 0.0],
  ['Aveia em flocos', 100, 'g', 394, 13.9, 66.6, 8.5],
  ['Granola tradicional', 100, 'g', 471, 9.0, 65.0, 19.0],
  ['Cuscuz de milho cozido', 100, 'g', 113, 2.4, 25.3, 0.5],

  // Frutas
  ['Banana prata', 100, 'g', 98, 1.3, 26.0, 0.1],
  ['Maçã com casca', 100, 'g', 56, 0.3, 15.2, 0.1],
  ['Mamão papaia', 100, 'g', 40, 0.5, 10.4, 0.1],
  ['Laranja pera', 100, 'g', 37, 1.0, 8.9, 0.1],
  ['Abacate', 100, 'g', 96, 1.2, 6.0, 8.4],
  ['Melancia', 100, 'g', 33, 0.9, 8.1, 0.1],

  // Legumes e verduras
  ['Alface crespa', 100, 'g', 11, 1.3, 1.7, 0.2],
  ['Tomate cru', 100, 'g', 15, 1.1, 3.1, 0.2],
  ['Cenoura crua', 100, 'g', 34, 1.3, 7.7, 0.2],
  ['Brócolis cozido', 100, 'g', 25, 2.1, 4.4, 0.5],
  ['Abobrinha cozida', 100, 'g', 19, 1.1, 3.0, 0.2],

  // Gorduras e outros
  ['Azeite de oliva', 100, 'ml', 884, 0.0, 0.0, 100.0],
  ['Óleo de soja', 100, 'ml', 884, 0.0, 0.0, 100.0],
  ['Manteiga com sal', 100, 'g', 726, 0.4, 0.1, 82.4],
  ['Amendoim torrado', 100, 'g', 577, 27.2, 20.3, 43.9],
  ['Castanha-do-pará', 100, 'g', 643, 14.5, 15.1, 63.5],
  ['Açúcar refinado', 100, 'g', 387, 0.0, 99.5, 0.0],
  ['Whey protein concentrado', 100, 'g', 400, 80.0, 8.0, 5.0],
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

if (process.argv.includes('--status')) {
  console.log(run('select source, count(*) from public.foods group by source order by source'));
  process.exit(0);
}

if (process.argv.includes('--remove')) {
  run("delete from public.foods where source = 'seed'");
  console.log('removidos os alimentos de teste (source = seed).');
  console.log(run('select count(*) as restantes from public.foods'));
  process.exit(0);
}

// Idempotente: o mesmo nome não entra duas vezes.
const values = FOODS.map(
  ([name, size, unit, kcal, p, c, f]) =>
    `(${quote(name)}, ${size}, ${quote(unit)}, ${kcal}, ${p}, ${c}, ${f}, 'seed', false)`,
).join(',\n  ');

run(`
  insert into public.foods
    (name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, source, verified)
  select v.name, v.serving_size, v.serving_unit, v.calories, v.protein_g, v.carbs_g, v.fat_g,
         v.source::public.food_source, v.verified
  from (values
  ${values}
  ) as v(name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, source, verified)
  where not exists (
    select 1 from public.foods f where lower(f.name) = lower(v.name)
  );
`);

console.log(`${FOODS.length} alimentos de referência processados.`);
console.log(run('select source, count(*) from public.foods group by source order by source'));
