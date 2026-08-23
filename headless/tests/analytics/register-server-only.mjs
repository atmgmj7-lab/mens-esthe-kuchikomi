import { registerHooks } from "node:module";

let registered = false;

export function registerServerOnly() {
  if (registered) return;
  registered = true;

  registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === "server-only") {
        return {
          shortCircuit: true,
          url: "data:text/javascript,export%20%7B%7D%3B",
        };
      }
      if (specifier === "next/cache") {
        return {
          shortCircuit: true,
          url: "data:text/javascript,export%20const%20cacheLife%3D()%3D%3E%7B%7D%3Bexport%20const%20cacheTag%3D()%3D%3E%7B%7D%3B",
        };
      }
      if (specifier.startsWith("@/")) {
        return {
          shortCircuit: true,
          url: new URL(`../../${specifier.slice(2)}.ts`, import.meta.url).href,
        };
      }
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".mjs")) {
        return {
          shortCircuit: true,
          url: new URL(`${specifier}.ts`, context.parentURL).href,
        };
      }
      return nextResolve(specifier, context);
    },
  });
}
