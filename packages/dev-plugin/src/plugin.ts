import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ViteDevServer } from "vite";
import {
  handleGetThread,
  handleListThreads,
  handleSetResolved,
  handleThreadLocation
} from "./handlers/threads";
import {
  handleGetSpec,
  handleListSpecs,
  handleSyncAll,
  handleSyncOne
} from "./handlers/specs";
import { matchRoute } from "./router";
import { createDevSupabase, type StorageConfig } from "./supabase";

export interface AgenticPRDDevOptions {
  storage: StorageConfig;
  specSyncDir?: string;
  projectRoot?: string;
  prefix?: string;
}

const DISCOVERY_FILE = ".agentic-prd.dev.json";

function findWorkspaceRoot(start: string): string {
  let current = start;
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

function isLocal(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? "";
  return (
    addr === "127.0.0.1" ||
    addr === "::1" ||
    addr === "::ffff:127.0.0.1"
  );
}

function sendJSON(
  res: ServerResponse,
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJSON(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function parseQuery(url: string): URLSearchParams {
  const qIdx = url.indexOf("?");
  if (qIdx < 0) return new URLSearchParams();
  return new URLSearchParams(url.slice(qIdx + 1));
}

export default function agenticPRDDev(options: AgenticPRDDevOptions): Plugin {
  const prefix = options.prefix ?? "/__agentic-prd";
  const workspaceRoot = findWorkspaceRoot(process.cwd());
  const projectRoot = options.projectRoot
    ? isAbsolute(options.projectRoot)
      ? options.projectRoot
      : resolve(workspaceRoot, options.projectRoot)
    : workspaceRoot;
  const specSyncDir = options.specSyncDir
    ? isAbsolute(options.specSyncDir)
      ? options.specSyncDir
      : resolve(workspaceRoot, options.specSyncDir)
    : resolve(workspaceRoot, "docs/specs");
  const supabase = createDevSupabase(options.storage);
  const discoveryPath = join(workspaceRoot, DISCOVERY_FILE);

  return {
    name: "agentic-prd:dev",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      const port = server.config.server?.port ?? 5173;
      writeFileSync(
        discoveryPath,
        `${JSON.stringify({ port, prefix }, null, 2)}\n`,
        "utf8"
      );
      const cleanup = () => {
        try {
          if (existsSync(discoveryPath)) unlinkSync(discoveryPath);
        } catch {
          /* best effort */
        }
      };
      server.httpServer?.on("close", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
      process.once("exit", cleanup);

      server.middlewares.use(prefix, async (req, res, next) => {
        try {
          if (!isLocal(req)) {
            sendJSON(res, 403, {
              error: "forbidden",
              message: "localhost only"
            });
            return;
          }
          const url = req.url ?? "";
          const method = req.method ?? "GET";
          const pathname = url.split("?", 1)[0] ?? "/";
          const route = matchRoute(method, pathname);
          if (!route) {
            next();
            return;
          }
          const query = parseQuery(url);

          switch (route.kind) {
            case "listThreads": {
              const resolved = query.get("resolved");
              const result = await handleListThreads(supabase, {
                path: query.get("path") ?? undefined,
                resolved:
                  resolved === null ? undefined : resolved === "true",
                limit: query.get("limit")
                  ? Number.parseInt(query.get("limit") ?? "0", 10)
                  : undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getThread": {
              const id = route.params["id"] ?? "";
              const thread = await handleGetThread(supabase, id);
              if (!thread) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id
                });
                return;
              }
              sendJSON(res, 200, thread);
              return;
            }
            case "threadLocation": {
              const id = route.params["id"] ?? "";
              const result = await handleThreadLocation(
                supabase,
                projectRoot,
                id
              );
              sendJSON(res, 200, result);
              return;
            }
            case "resolveThread":
            case "unresolveThread": {
              const id = route.params["id"] ?? "";
              const resolvedFlag = route.kind === "resolveThread";
              const result = await handleSetResolved(supabase, id, resolvedFlag);
              sendJSON(res, 200, result);
              return;
            }
            case "listSpecs": {
              const result = await handleListSpecs(supabase, {
                path: query.get("path") ?? undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getSpec": {
              const id = route.params["id"] ?? "";
              const spec = await handleGetSpec(supabase, id);
              if (!spec) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "spec",
                  id
                });
                return;
              }
              sendJSON(res, 200, spec);
              return;
            }
            case "syncSpecs": {
              void (await readJSON(req));
              const result = await handleSyncAll(supabase, specSyncDir, {
                path: query.get("path") ?? undefined
              });
              sendJSON(res, 200, result);
              return;
            }
            case "syncOneSpec": {
              const id = route.params["id"] ?? "";
              const result = await handleSyncOne(supabase, specSyncDir, id);
              if (!result) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "spec",
                  id
                });
                return;
              }
              sendJSON(res, 200, result);
              return;
            }
          }
        } catch (err) {
          const error = err as Error;
          sendJSON(res, 500, {
            error: "internal",
            message: error.message,
            stack: error.stack
          });
        }
      });
    }
  };
}
