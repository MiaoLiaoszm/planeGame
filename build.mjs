import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join, posix } from "node:path";

const SRC_DIR = "src";
const ENTRY = "main.js";
const OUT_DIR = "dist";
const OUT_FILE = join(OUT_DIR, "sky-patrol.js");

const IMPORT_RE = /import\s*\{([\s\S]*?)\}\s*from\s*"([^"]+)"\s*;/g;
const EXPORT_RE = /export\s*\{([\s\S]*?)\}\s*;/g;

const modules = new Map();

function resolveSpec(importer, spec) {
  return posix.normalize(posix.join(posix.dirname(importer), spec)).replace(/^\.\//, "");
}

function readModule(relPath) {
  if (modules.has(relPath)) return modules.get(relPath);
  const filePath = resolve(SRC_DIR, relPath);
  const text = readFileSync(filePath, "utf8");
  const deps = [];
  for (const match of text.matchAll(IMPORT_RE)) {
    const dep = resolveSpec(relPath, match[2]);
    if (!deps.includes(dep)) deps.push(dep);
  }
  const record = { relPath, text, deps };
  modules.set(relPath, record);
  for (const dep of deps) readModule(dep);
  return record;
}

const order = [];
const visiting = new Set();
const visited = new Set();

function walk(relPath) {
  if (visited.has(relPath)) return;
  if (visiting.has(relPath)) throw new Error(`循环依赖: ${relPath}`);
  visiting.add(relPath);
  for (const dep of modules.get(relPath).deps) walk(dep);
  visiting.delete(relPath);
  visited.add(relPath);
  order.push(relPath);
}

readModule(ENTRY);
walk(ENTRY);

function destructure(names) {
  return names
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const alias = part.split(/\s+as\s+/);
      return alias.length === 2 ? `${alias[0].trim()}: ${alias[1].trim()}` : part;
    })
    .join(", ");
}

function transform(record) {
  let body = record.text.replace(IMPORT_RE, (full, names, spec) => {
    const dep = resolveSpec(record.relPath, spec);
    return `const { ${destructure(names)} } = __req("${dep}");`;
  });

  body = body.replace(EXPORT_RE, (full, names) => {
    const list = names
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    return list.map((name) => `__exports.${name} = ${name};`).join("\n");
  });

  if (/^\s*(import|export)\s/m.test(body)) {
    throw new Error(`${record.relPath} 仍有未处理的 import/export 语句`);
  }

  const indent = (text) =>
    text
      .split("\n")
      .map((line) => (line.trim() === "" ? "" : `  ${line}`))
      .join("\n");

  return `__def("${record.relPath}", function (__exports, __req) {\n${indent(body)}\n});`;
}

const parts = [
  "(function () {",
  '  "use strict";',
  "  const __defs = {};",
  "  const __cache = {};",
  "",
  "  function __def(name, factory) {",
  "    __defs[name] = factory;",
  "  }",
  "",
  "  function __req(name) {",
  "    const cached = __cache[name];",
  "    if (cached) return cached.exports;",
  "    const factory = __defs[name];",
  '    if (!factory) throw new Error("模块未注册: " + name);',
  "    const module = { exports: {} };",
  "    __cache[name] = module;",
  "    factory(module.exports, __req);",
  "    return module.exports;",
  "  }",
  "",
  ...order.map((relPath) => transform(modules.get(relPath))),
  "",
  `  __req("${ENTRY}");`,
  "})();",
  "",
];

mkdirSync(OUT_DIR, { recursive: true });
const output = parts.join("\n");
writeFileSync(OUT_FILE, output, "utf8");

const lineCount = output.split("\n").length;
console.log(`[bundle] ${OUT_FILE} modules=${order.length} lines=${lineCount} bytes=${Buffer.byteLength(output)}`);
console.log(`[bundle] order: ${order.join(" -> ")}`);