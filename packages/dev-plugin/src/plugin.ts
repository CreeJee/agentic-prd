import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, isAbsolute, join, resolve } from "node:path";
import type { Plugin, ViteDevServer } from "vite";
import {
  handleDeleteSpec,
  handleGetSpec,
  handleListSpecs,
  handlePutSpec,
  handleSyncAll,
  handleSyncOne,
  type SpecPutInput,
} from "./handlers/specs.js";
import {
  type AppendCommentInput,
  type CreateThreadInput,
  handleAppendComment,
  handleCreateThread,
  handleDeleteThread,
  handleGetThread,
  handleListThreads,
  handlePatchThread,
  handleSetResolved,
  handleThreadLocation,
  type ThreadPatchInput,
} from "./handlers/threads.js";
import { matchRoute } from "./router.js";
import { createFileStorage, type DevStorage } from "./storage.js";

export interface AgenticPRDDevOptions {
  specSyncDir?: string;
  projectRoot?: string;
  prefix?: string;
}

const DISCOVERY_FILE = ".agentic-prd.dev.json";
const DATA_DIR = ".agentic-prd";

/**
 * 데이터/디스커버리 루트. pnpm-workspace.yaml 이 있으면 workspace 루트(모노레포에서
 * skill 이 워크스페이스 루트를 탐색하는 기존 흐름 호환), 없으면 Vite config.root —
 * npm/yarn 단일 앱에서 process.cwd 가 어디든 앱 루트에 고정되도록.
 */
function resolveDataRoot(configRoot: string): string {
  let current = configRoot;
  while (true) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) return configRoot;
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

const MAX_BODY_BYTES = 1024 * 1024;

/** 클라이언트 귀책 요청 오류 — 상태코드와 함께 4xx 로 응답한다. */
class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** PATCH/create 바디의 필드 타입을 검증해 저장소 오염(예: comments 비배열로 이력 파괴)을 막는다. */
function invalidThreadFields(body: {
  xPct?: unknown;
  yPx?: unknown;
  resolved?: unknown;
  comments?: unknown;
}): string | null {
  if (body.xPct !== undefined && !Number.isFinite(body.xPct)) return "xPct";
  if (body.yPx !== undefined && !Number.isFinite(body.yPx)) return "yPx";
  if (body.resolved !== undefined && typeof body.resolved !== "boolean")
    return "resolved";
  if (body.comments !== undefined && !Array.isArray(body.comments))
    return "comments";
  return null;
}

function readJSONBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    req.on("data", (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        reject(new HttpError(413, "body too large"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooLarge) return;
      if (chunks.length === 0) {
        resolveBody(undefined);
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export default function agenticPRDDev(
  options: AgenticPRDDevOptions = {}
): Plugin {
  const prefix = options.prefix ?? "/__agentic-prd";
  let storage: DevStorage | null = null;
  let projectRoot = "";
  let specSyncDir = "";
  let discoveryPath = "";

  return {
    name: "agentic-prd:dev",
    apply: "serve",
    configResolved(config) {
      const dataRoot = resolveDataRoot(config.root);
      projectRoot = options.projectRoot
        ? isAbsolute(options.projectRoot)
          ? options.projectRoot
          : resolve(dataRoot, options.projectRoot)
        : dataRoot;
      specSyncDir = options.specSyncDir
        ? isAbsolute(options.specSyncDir)
          ? options.specSyncDir
          : resolve(dataRoot, options.specSyncDir)
        : resolve(dataRoot, "docs/specs");
      storage = createFileStorage(join(dataRoot, DATA_DIR));
      discoveryPath = join(dataRoot, DISCOVERY_FILE);
    },
    configureServer(server: ViteDevServer) {
      const configuredPort = server.config.server?.port ?? 5173;
      const cleanup = () => {
        try {
          if (discoveryPath && existsSync(discoveryPath))
            unlinkSync(discoveryPath);
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
          const store = storage;
          if (!store) {
            sendJSON(res, 500, {
              error: "internal",
              message: "storage not initialized",
            });
            return;
          }
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
          const rawId = route.params["id"];
          const id = rawId === undefined ? "" : decodeURIComponent(rawId);

          switch (route.kind) {
            case "listThreads": {
              const resolvedParam = query.get("resolved");
              const result = await handleListThreads(store, {
                path: query.get("path") ?? undefined,
                resolved:
                  resolvedParam === null ? undefined : resolvedParam === "true",
                limit: query.get("limit")
                  ? Number.parseInt(query.get("limit") ?? "0", 10)
                  : undefined,
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getThread": {
              const thread = await handleGetThread(store, id);
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
            case "createThread": {
              const body = (await readJSONBody(req)) as
                | Partial<CreateThreadInput>
                | undefined;
              if (
                !body ||
                typeof body.id !== "string" ||
                typeof body.path !== "string" ||
                !Number.isFinite(body.xPct) ||
                !Number.isFinite(body.yPx)
              ) {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: "id/path/xPct/yPx required",
                });
                return;
              }
              const invalidField = invalidThreadFields(body);
              if (invalidField) {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: `invalid field: ${invalidField}`,
                });
                return;
              }
              const created = await handleCreateThread(
                store,
                body as CreateThreadInput
              );
              sendJSON(res, 201, created);
              return;
            }
            case "patchThread": {
              const body = (await readJSONBody(req)) as
                | ThreadPatchInput
                | undefined;
              const field = invalidThreadFields(body ?? {});
              if (field) {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: `invalid field: ${field}`,
                });
                return;
              }
              const patched = await handlePatchThread(store, id, body ?? {});
              if (!patched) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id,
                });
                return;
              }
              sendJSON(res, 200, patched);
              return;
            }
            case "deleteThread": {
              const deleted = await handleDeleteThread(store, id);
              if (!deleted) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id,
                });
                return;
              }
              sendJSON(res, 200, { ok: true });
              return;
            }
            case "appendComment": {
              const body = (await readJSONBody(req)) as
                | Partial<AppendCommentInput>
                | undefined;
              if (
                !body ||
                typeof body.author !== "string" ||
                typeof body.text !== "string"
              ) {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: "author/text required",
                });
                return;
              }
              const appended = await handleAppendComment(
                store,
                id,
                body as AppendCommentInput
              );
              if (!appended) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id,
                });
                return;
              }
              sendJSON(res, 200, appended);
              return;
            }
            case "resolveThread":
            case "unresolveThread": {
              const resolvedFlag = route.kind === "resolveThread";
              const result = await handleSetResolved(store, id, resolvedFlag);
              if (!result) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "thread",
                  id,
                });
                return;
              }
              sendJSON(res, 200, result);
              return;
            }
            case "threadLocation": {
              const result = await handleThreadLocation(store, projectRoot, id);
              sendJSON(res, 200, result);
              return;
            }
            case "listSpecs": {
              const result = await handleListSpecs(store, {
                path: query.get("path") ?? undefined,
              });
              sendJSON(res, 200, result);
              return;
            }
            case "getSpec": {
              const spec = await handleGetSpec(store, id);
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
            case "putSpec": {
              const body = (await readJSONBody(req)) as
                | Partial<SpecPutInput>
                | undefined;
              if (!body || typeof body.path !== "string") {
                sendJSON(res, 400, {
                  error: "bad-request",
                  message: "path required",
                });
                return;
              }
              const saved = await handlePutSpec(
                store,
                id,
                body as SpecPutInput
              );
              sendJSON(res, 200, saved);
              return;
            }
            case "deleteSpec": {
              const deleted = await handleDeleteSpec(store, id);
              if (!deleted) {
                sendJSON(res, 404, {
                  error: "not-found",
                  resource: "spec",
                  id,
                });
                return;
              }
              sendJSON(res, 200, { ok: true });
              return;
            }
            case "syncSpecs": {
              const result = await handleSyncAll(store, specSyncDir, {
                path: query.get("path") ?? undefined,
              });
              sendJSON(res, 200, result);
              return;
            }
            case "syncOneSpec": {
              const result = await handleSyncOne(store, specSyncDir, id);
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
            default: {
              route.kind satisfies never;
              next();
              return;
            }
          }
        } catch (err) {
          if (err instanceof HttpError) {
            sendJSON(res, err.status, {
              error: err.status === 413 ? "payload-too-large" : "bad-request",
              message: err.message,
            });
            return;
          }
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
