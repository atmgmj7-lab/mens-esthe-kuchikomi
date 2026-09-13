import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
export function createSourceLoader(overrides = new Map()) {
const cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const mod = { exports: {} }; cache.set(path, mod);
  const localRequire = (id) => {
    if (id === 'server-only') return {};
    if (id.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
    if (!id.startsWith('.') && !id.startsWith('@/')) return require(id);
    const base = id.startsWith('@/') ? resolve(id.slice(2)) : resolve(dirname(path), id);
    return load(['.ts', '.tsx', '.mjs', ''].map(ext => base + ext).find(existsSync));
  };
  vm.runInNewContext(ts.transpileModule(overrides.get(path) ?? readFileSync(path, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true
  }}).outputText, { module: mod, exports: mod.exports, require: localRequire, URL, URLSearchParams, Date, console, process, Buffer, Headers, Response, Request, fetch, setTimeout, clearTimeout });
  return mod.exports;
}
return load;
}
