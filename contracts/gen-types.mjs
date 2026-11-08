// contracts/*.schema.json -> frontend/src/types/*.ts (+ index.ts). Çalıştırma: npm run gen:types
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "json-schema-to-typescript";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "frontend", "src", "types");
mkdirSync(outDir, { recursive: true });

const pascal = (s) => s.split("_").map((p) => p[0].toUpperCase() + p.slice(1)).join("");
const banner = (n) => `/**\n * BU DOSYA OTOMATİK ÜRETİLDİ — elle düzenleme. Kaynak: contracts/${n}.schema.json\n */`;
const load = (n) => JSON.parse(readFileSync(join(here, `${n}.schema.json`), "utf8"));
const names = readdirSync(here).filter((f) => f.endsWith(".schema.json")).map((f) => f.replace(".schema.json", "")).sort();

// common: tsType'ları çıkar, tüm tanımları (unreachable) üret. Diğerleri tsType sayesinde ortak adlara bağlanır.
const common = load("common");
const commonNames = Object.keys(common.$defs);
const strip = (o) => { if (o && typeof o === "object") { delete o.tsType; Object.values(o).forEach(strip); } return o; };

const out = {};
const cc = strip(structuredClone(common));
cc.title = "Common";
out.common = (await compile(cc, "Common", { bannerComment: banner("common"), unreachableDefinitions: true, cwd: here }))
  .replace(/\/\*\*(?:(?!\*\/)[^])*\*\/\s*export interface Common \{\s*\[k: string\]: unknown;\s*\}\s*/, "");
for (const n of names.filter((x) => x !== "common")) {
  const schema = load(n);
  schema.title = pascal(n);
  let ts = await compile(schema, schema.title, { bannerComment: banner(n), cwd: here, additionalProperties: false });
  // tsType'lı ortak tanımlar için üretilen `export type X = X;` takma adlarını at; X, common.ts'ten gelir.
  for (const c of commonNames) ts = ts.replace(new RegExp(`/\\*\\*(?:(?!\\*/)[^])*\\*/\\s*export type ${c} = ${c};\\n`), "");
  const used =commonNames.filter((c) => new RegExp(`(?<![A-Za-z0-9_])${c}(?![A-Za-z0-9_])`).test(ts));
  if (used.length) ts = ts.replace(/(\*\/\n)/, `$1\nimport type { ${used.join(", ")} } from "./common";\n`);
  out[n] = ts;
}
for (const [n, ts] of Object.entries(out)) writeFileSync(join(outDir, `${n}.ts`), ts);
const idx = `${banner("*")}\n\n` + Object.keys(out).map((n) => `export * from "./${n}";`).join("\n") + "\n";
writeFileSync(join(outDir, "index.ts"), idx);
console.log("üretildi:", Object.keys(out).join(", "), "+ index");
