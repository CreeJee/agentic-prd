import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import {
  handleGetSpec,
  handleListSpecs,
  handleSyncAll,
  handleSyncOne,
} from "./handlers/specs.js";
import {
  handleGetThread,
  handleListThreads,
  handleSetResolved,
  handleThreadLocation,
} from "./handlers/threads.js";
import { matchRoute } from "./router.js";
import { createDevSupabase, type StorageConfig } from "./supabase.js";

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
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
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
      const configuredPort = server.config.server?.port ?? 5173;
      const cleanup = () => {
        try {
          if (existsSync(discoveryPath)) unlinkSync(discoveryPath);
        } catch {
          /* best effort */
        }
      };
      const writeDiscovery = (port: number) => {
        writeFileSync(
          discoveryPath,
          `${JSON.stringify({ port, prefix }, null, 2)}\n`,
          "utf8"
        );
      };
      /**
       * Vite 는 요청 port 가 사용 중이면 자동으로 다음 port 로 fallback 한다.
       * 그래서 discovery 파일은 실제로 listen 이 성립한 시점에 실주소로 기록해야
       * skill 이 올바른 port 로 curl 할 수 있다.
       */
      const httpServer = server.httpServer;
      if (httpServer?.listening) {
        const address = httpServer.address();
        writeDiscovery(
          typeof address === "object" && address ? address.port : configuredPort
        );
      } else if (httpServer) {
        httpServer.once("listening", () => {
          const address = httpServer.address();
          writeDiscovery(
            typeof address === "object" && address
              ? address.port
              : configuredPort
          );
        });
      } else {
        writeDiscovery(configuredPort);
      }
      server.httpServer?.on("close", cleanup);
      process.once("SIGINT", cleanup);
      process.once("SIGTERM", cleanup);
      process.once("exit", cleanup);

      server.middlewares.use(prefix, async (req, res, next) => {
        try {
          if (!isLocal(req)) {
            sendJSON(res, 403, {
              error: "forbidden",
              message: "localhost only",
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
                resolved: resolved === null ? undefined : resolved === "true",
                limit: query.get("limit")
                  ? Number.parseInt(query.get("limit") ?? "0", 10)
                  : undefined,
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
                  id,
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
              const result = await handleSetResolved(
                supabase,
                id,
                resolvedFlag
              );
              sendJSON(res, 200, result);
              return;
            }
            case "listSpecs": {
              const result = await handleListSpecs(supabase, {
                path: query.get("path") ?? undefined,
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
                  id,
                });
                return;
              }
              sendJSON(res, 200, spec);
              return;
            }
            case "syncSpecs": {
              const result = await handleSyncAll(supabase, specSyncDir, {
                path: query.get("path") ?? undefined,
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
                  id,
                });
                return;
              }
              sendJSON(res, 200, result);
              return;
            }
            /** 라우터에는 있으나 아직 배선 전인 kind — 응답 없이 행이 걸리지 않게 폴스루 */
            default: {
              next();
              return;
            }
          }
        } catch (err) {
          const error = err as Error;
          const includeStack = process.env["NODE_ENV"] !== "production";
          sendJSON(res, 500, {
            error: "internal",
            message: error.message,
            stack: includeStack ? error.stack : undefined,
          });
        }
      });
    },
  };
}
