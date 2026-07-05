import {
  type Fiber,
  getDisplayName,
  getFiberFromHostInstance,
  isCompositeFiber,
} from "bippy";
import {
  getOwnerStack,
  getSource,
  normalizeFileName,
  type StackFrame,
} from "bippy/source";
import type { ReactSourceLocation } from "../store";

type TraceSource = Omit<
  ReactSourceLocation,
  "componentName" | "key" | "ownerName"
>;

interface TraceFrame {
  name: string;
  key?: string;
  source?: TraceSource;
  ownerName?: string;
}

export interface ReactCaptureContext {
  path?: string[];
  source?: ReactSourceLocation;
}

function isUsefulName(name: string | null | undefined): name is string {
  if (!name) return false;
  if (name === "anonymous" || name === "Unknown") return false;
  if (name.startsWith("react-stack-")) return false;
  /** React 컴포넌트는 PascalCase. 소문자로 시작하면 HTML 태그(li, div…) 나 내부 함수라 제외. */
  const first = name[0];
  if (first && first === first.toLowerCase() && first !== first.toUpperCase()) {
    return false;
  }
  return true;
}

function sourceOfFrame(frame: StackFrame): TraceSource | undefined {
  if (!frame.fileName) return undefined;
  return {
    fileName: normalizeFileName(frame.fileName),
    lineNumber: frame.lineNumber,
    columnNumber: frame.columnNumber,
  };
}

function ownerNameOf(fiber: Fiber): string | undefined {
  const owner = fiber._debugOwner;
  if (!owner) return undefined;
  const name = getDisplayName(owner.type);
  return isUsefulName(name) ? name : undefined;
}

function nearestFiberOf(el: Element): Fiber | null {
  let current: Element | null = el;
  while (current) {
    const fiber = getFiberFromHostInstance(current);
    if (fiber) return fiber;
    current = current.parentElement;
  }
  return null;
}

async function sourceOfFiber(fiber: Fiber): Promise<TraceSource | undefined> {
  try {
    const source = await getSource(fiber);
    if (!source?.fileName) return undefined;
    return {
      fileName: normalizeFileName(source.fileName),
      lineNumber: source.lineNumber,
      columnNumber: source.columnNumber,
    };
  } catch {
    return undefined;
  }
}

async function returnTreeTraceOf(fiber: Fiber): Promise<TraceFrame[]> {
  const trace: TraceFrame[] = [];
  let current: Fiber | null = fiber;

  while (current) {
    if (isCompositeFiber(current)) {
      const name = getDisplayName(current.type);
      if (isUsefulName(name)) {
        const previous = trace[trace.length - 1];
        const source = await sourceOfFiber(current);
        const key = current.key == null ? undefined : String(current.key);
        const ownerName = ownerNameOf(current);
        const frame: TraceFrame = { name, key, source };
        if (ownerName && ownerName !== name) frame.ownerName = ownerName;
        if (
          previous?.name !== frame.name ||
          previous.source?.fileName !== frame.source?.fileName
        ) {
          trace.push(frame);
        }
      }
    }
    current = current.return;
  }

  return trace;
}

async function ownerStackTraceOf(fiber: Fiber): Promise<TraceFrame[]> {
  try {
    const stack = await getOwnerStack(fiber);
    return stack
      .map((frame): TraceFrame | null => {
        const name = frame.functionName;
        if (!isUsefulName(name)) return null;
        return {
          name,
          source: sourceOfFrame(frame),
        };
      })
      .filter((frame): frame is TraceFrame => frame !== null);
  } catch {
    return [];
  }
}

function mergeTraceFrames(
  returnTreeTrace: TraceFrame[],
  ownerStackTrace: TraceFrame[]
): TraceFrame[] {
  const merged: TraceFrame[] = [];
  const usedOwnerIndexes = new Set<number>();

  for (const frame of returnTreeTrace) {
    const ownerIndex = ownerStackTrace.findIndex(
      (ownerFrame, index) =>
        !usedOwnerIndexes.has(index) && ownerFrame.name === frame.name
    );
    const ownerFrame =
      ownerIndex === -1 ? undefined : ownerStackTrace[ownerIndex];
    if (ownerIndex !== -1) usedOwnerIndexes.add(ownerIndex);
    merged.push({
      ...frame,
      source: frame.source ?? ownerFrame?.source,
    });
  }

  for (const [index, frame] of ownerStackTrace.entries()) {
    if (usedOwnerIndexes.has(index)) continue;
    if (merged.some((candidate) => candidate.name === frame.name)) continue;
    merged.push(frame);
  }

  return merged;
}

/**
 * 소스 파일 경로 우선순위. 낮은 값이 "더 사용자의 코드에 가깝다".
 *  - 40: node_modules / .pnpm — 서드파티
 *  - 30: 위젯 자체(`agentic-prd`) — 위젯 내부 컴포넌트
 *  -  0: 그 외(호스트 앱) — 실제 코멘트를 남기려는 위치일 확률이 가장 높음
 */
function sourceRank(source: TraceSource): number {
  const fileName = source.fileName;
  if (fileName.includes("/node_modules/") || fileName.includes("/.pnpm/")) {
    return 40;
  }
  if (
    fileName.includes("agentic-prd/src/") ||
    fileName.includes("agentic-prd/dist/") ||
    fileName.includes("node_modules/agentic-prd/")
  ) {
    return 30;
  }
  return 0;
}

function selectSource(trace: TraceFrame[]): ReactSourceLocation | undefined {
  let selected: { frame: TraceFrame; rank: number } | undefined;
  for (const frame of trace) {
    if (!frame.source) continue;
    const rank = sourceRank(frame.source);
    if (!selected || rank < selected.rank) selected = { frame, rank };
    if (rank === 0) break;
  }
  if (!selected?.frame.source) return undefined;
  return {
    componentName: selected.frame.name,
    key: selected.frame.key,
    ownerName: selected.frame.ownerName,
    ...selected.frame.source,
  };
}

/** 엘리먼트에서 React component path 와 대표 source location 을 수집 */
export async function reactContextOf(
  el: Element
): Promise<ReactCaptureContext> {
  const fiber = nearestFiberOf(el);
  if (!fiber) return {};

  const [returnTreeTrace, ownerStackTrace] = await Promise.all([
    returnTreeTraceOf(fiber),
    ownerStackTraceOf(fiber),
  ]);
  const trace = mergeTraceFrames(returnTreeTrace, ownerStackTrace);
  return {
    path: trace.length ? trace.map((frame) => frame.name) : undefined,
    source: selectSource(trace),
  };
}

/** 엘리먼트에서 안쪽→바깥 named 컴포넌트 경로를 수집 */
export async function reactPathOf(el: Element): Promise<string[] | undefined> {
  return (await reactContextOf(el)).path;
}
