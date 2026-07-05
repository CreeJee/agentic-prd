export type RouteKind =
  | "listThreads"
  | "getThread"
  | "resolveThread"
  | "unresolveThread"
  | "threadLocation"
  | "listSpecs"
  | "getSpec"
  | "syncSpecs"
  | "syncOneSpec";

export interface Route {
  kind: RouteKind;
  params: Record<string, string>;
}

interface Def {
  method: "GET" | "POST";
  pattern: RegExp;
  kind: RouteKind;
  paramNames: string[];
}

const DEFS: Def[] = [
  { method: "GET", pattern: /^\/threads\/?$/, kind: "listThreads", paramNames: [] },
  { method: "GET", pattern: /^\/threads\/([^/]+)\/location\/?$/, kind: "threadLocation", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/resolve\/?$/, kind: "resolveThread", paramNames: ["id"] },
  { method: "POST", pattern: /^\/threads\/([^/]+)\/unresolve\/?$/, kind: "unresolveThread", paramNames: ["id"] },
  { method: "GET", pattern: /^\/threads\/([^/]+)\/?$/, kind: "getThread", paramNames: ["id"] },
  { method: "GET", pattern: /^\/specs\/?$/, kind: "listSpecs", paramNames: [] },
  { method: "POST", pattern: /^\/specs\/sync\/?$/, kind: "syncSpecs", paramNames: [] },
  { method: "POST", pattern: /^\/specs\/([^/]+)\/sync\/?$/, kind: "syncOneSpec", paramNames: ["id"] },
  { method: "GET", pattern: /^\/specs\/([^/]+)\/?$/, kind: "getSpec", paramNames: ["id"] }
];

export function matchRoute(method: string, path: string): Route | null {
  for (const def of DEFS) {
    if (def.method !== method) continue;
    const match = path.match(def.pattern);
    if (!match) continue;
    const params: Record<string, string> = {};
    def.paramNames.forEach((name, i) => {
      const value = match[i + 1];
      if (value !== undefined) params[name] = value;
    });
    return { kind: def.kind, params };
  }
  return null;
}
