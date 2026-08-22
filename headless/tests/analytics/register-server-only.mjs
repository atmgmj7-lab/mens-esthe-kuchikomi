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
