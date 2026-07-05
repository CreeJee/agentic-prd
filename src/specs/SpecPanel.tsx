import { valibotResolver } from "@hookform/resolvers/valibot";
import {
  ChevronLeftIcon,
  ExternalLinkIcon,
  LinkIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "../cn";
import { MarkdownEditor } from "../components/MarkdownEditor";
import type { SpecDoc, SpecStatus } from "./store";
import {
  createLinkedSpecDoc,
  createSpecDoc,
  SPEC_STATUS_LABEL,
  useCreateSpec,
  useDeleteSpec,
  useSaveSpec,
  useSpecDoc,
  useSpecDocsForPath,
} from "./store";

function timeAgo(at: number): string {
  const m = Math.floor((Date.now() - at) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

const STATUS_BADGE: Record<SpecStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  REVIEW: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
};

const specEditorSchema = v.object({
  title: v.string(),
  status: v.picklist(["DRAFT", "REVIEW", "CONFIRMED"]),
  body: v.string(),
});

function parseGoogleDocsId(url: string): string | null {
  const match = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] ?? null;
}

interface SpecPanelProps {
  path: string;
  pageLabel: string;
  open: boolean;
  onClose: () => void;
  /** 코멘트 위젯의 현재 작성자 이름(스펙 문서 편집 작성자로 사용) */
  author: string;
}

const BOX_KEY = "demo-spec-panel-box";
const MIN_W = 360;
const MIN_H = 300;
const MARGIN = 20;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function loadBox(): Box {
  try {
    const raw = localStorage.getItem(BOX_KEY);
    if (raw) {
      const b = JSON.parse(raw) as Box;
      if (
        typeof b.x === "number" &&
        typeof b.y === "number" &&
        typeof b.w === "number" &&
        typeof b.h === "number"
      ) {
        return b;
      }
    }
  } catch {}
  const w = 460;
  const x = Math.max(MARGIN, (window.innerWidth || 1280) - w - MARGIN);
  return { x, y: MARGIN, w, h: 0 };
}

export function SpecPanel({
  path,
  pageLabel,
  open,
  onClose,
  author,
}: SpecPanelProps) {
  const { data: docs = [], isLoading } = useSpecDocsForPath(path);
  const { mutateAsync: createSpec, isPending: loadingCreate } = useCreateSpec();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [box, setBox] = useState(loadBox);
  const drag = useRef<{
    type: "move" | "resize";
    dx: number;
    dy: number;
  } | null>(null);

  useEffect(() => {
    setSelectedId(null);
  }, [path]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (d.type === "move") {
        setBox((b) => {
          const maxX = window.innerWidth - 80;
          const maxY = window.innerHeight - 60;
          const x = Math.min(Math.max(0, e.clientX - d.dx), maxX);
          const y = Math.min(Math.max(0, e.clientY - d.dy), maxY);
          return { ...b, x, y };
        });
      } else {
        setBox((b) => {
          const w = Math.max(
            MIN_W,
            Math.min(window.innerWidth - b.x - 4, e.clientX - b.x)
          );
          const h = Math.max(
            MIN_H,
            Math.min(window.innerHeight - b.y - 4, e.clientY - b.y)
          );
          return { ...b, w, h };
        });
      }
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = null;
      document.body.style.userSelect = "";
      setBox((b) => {
        try {
          localStorage.setItem(BOX_KEY, JSON.stringify(b));
        } catch {}
        return b;
      });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  const startMove = (e: ReactPointerEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest("button, input, select, textarea, a")) return;
    if (!t.closest("[data-drag-handle]")) return;
    drag.current = {
      type: "move",
      dx: e.clientX - box.x,
      dy: e.clientY - box.y,
    };
    document.body.style.userSelect = "none";
  };

  if (!open) return null;

  const fullHeight = box.h === 0;

  return (
    <div
      onPointerDown={startMove}
      className="pointer-events-auto fixed z-99992 flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
      style={{
        left: box.x,
        top: box.y,
        width: box.w,
        height: fullHeight ? `calc(100vh - ${box.y + MARGIN}px)` : box.h,
      }}
    >
      {selectedId ? (
        <SpecEditor
          key={selectedId}
          path={path}
          docId={selectedId}
          pageLabel={pageLabel}
          author={author}
          onBack={() => setSelectedId(null)}
          onClose={onClose}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <SpecList
          docs={docs}
          pageLabel={pageLabel}
          loading={isLoading}
          creating={loadingCreate}
          onClose={onClose}
          onSelect={(id) => setSelectedId(id)}
          onCreate={async () => {
            const doc = createSpecDoc(path, "새 문서", author);
            await createSpec(doc);
            setSelectedId(doc.id);
          }}
          onCreateLinked={async (url: string, title: string) => {
            const doc = createLinkedSpecDoc(path, title, url, author);
            await createSpec(doc);
            setSelectedId(doc.id);
          }}
        />
      )}

      <div
        data-comment-no-capture=""
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          drag.current = { type: "resize", dx: 0, dy: 0 };
          document.body.style.userSelect = "none";
        }}
        title="드래그하여 크기 조절"
        className="absolute right-0 bottom-0 flex size-5 cursor-nwse-resize items-end justify-end p-1 text-slate-300 hover:text-slate-500"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M1 9L9 1M5 9L9 5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

function SpecList({
  docs,
  pageLabel,
  loading,
  creating,
  onClose,
  onSelect,
  onCreate,
  onCreateLinked,
}: {
  docs: SpecDoc[];
  pageLabel: string;
  loading: boolean;
  creating: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onCreateLinked: (url: string, title: string) => void;
}) {
  const [linkMode, setLinkMode] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const handleLinkSubmit = () => {
    if (!parseGoogleDocsId(linkUrl)) return;
    onCreateLinked(linkUrl, linkTitle);
    setLinkMode(false);
    setLinkUrl("");
    setLinkTitle("");
  };

  return (
    <>
      <div
        data-drag-handle
        data-comment-no-capture=""
        className="flex cursor-move items-center justify-between border-slate-100 border-b px-4 py-3"
      >
        <div className="flex min-w-0 flex-col">
          <span className="typo-regular-medium text-slate-900">기획 문서</span>
          <span className="truncate text-xs text-slate-400">{pageLabel}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="닫기"
          className="text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto p-3">
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onCreate}
            disabled={creating}
            className="flex-1 border-primary border-dashed font-medium text-primary hover:bg-orange-50"
          >
            {creating ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <PlusIcon className="size-4" />
            )}
            {creating ? "생성 중…" : "새 문서"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={() => setLinkMode(!linkMode)}
            aria-pressed={linkMode}
            className={cn(
              "border-dashed font-medium",
              linkMode
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-slate-300 text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
            )}
            title="Google Docs 연결"
          >
            <LinkIcon className="size-4" />
          </Button>
        </div>

        {linkMode && (
          <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
            <Input
              type="text"
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
              placeholder="문서 제목"
              className="focus:border-blue-400"
            />
            <Input
              type="text"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="Google Docs URL 붙여넣기"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLinkSubmit();
              }}
              className="focus:border-blue-400"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                {linkUrl && !parseGoogleDocsId(linkUrl)
                  ? "올바른 Google Docs URL을 입력해 주세요"
                  : "링크 공유가 설정된 문서만 표시돼요"}
              </span>
              <Button
                type="button"
                variant="default"
                size="xs"
                disabled={!parseGoogleDocsId(linkUrl)}
                onClick={handleLinkSubmit}
                className="bg-blue-500 text-white hover:bg-blue-600"
              >
                연결
              </Button>
            </div>
          </div>
        )}

        {loading && docs.length === 0 ? (
          <p className="flex items-center justify-center gap-1.5 px-1 py-6 text-center text-sm text-slate-400">
            <Loader2Icon className="size-4 animate-spin" />
            불러오는 중…
          </p>
        ) : docs.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-slate-400">
            아직 문서가 없어요. 이 화면의 정책·정의를 문서로 남겨보세요.
          </p>
        ) : (
          docs.map((doc) => {
            const isLinked = !!doc.externalUrl;
            const lineCount = doc.body
              .split("\n")
              .filter((l) => l.trim()).length;
            return (
              <button
                type="button"
                key={doc.id}
                onClick={() => onSelect(doc.id)}
                className="flex flex-col gap-1 rounded-lg border border-slate-200 px-3 py-2.5 text-left hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 truncate font-medium text-slate-900">
                    {isLinked && (
                      <ExternalLinkIcon className="size-3.5 shrink-0 text-blue-500" />
                    )}
                    {doc.title || "제목 없음"}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[doc.status]}`}
                  >
                    {SPEC_STATUS_LABEL[doc.status]}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {isLinked ? "Google Docs" : `${lineCount}줄`}
                  {doc.updatedBy ? ` · ${doc.updatedBy}` : ""} ·{" "}
                  {timeAgo(doc.updatedAt)}
                </span>
              </button>
            );
          })
        )}
      </div>

      <div className="border-slate-100 border-t px-4 py-2 text-right text-xs text-slate-400">
        공유됨
      </div>
    </>
  );
}

function SpecEditor({
  path,
  docId,
  pageLabel,
  author,
  onBack,
  onClose,
  onDeleted,
}: {
  path: string;
  docId: string;
  pageLabel: string;
  author: string;
  onBack: () => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { data: doc } = useSpecDoc(path, docId);
  const saveSpec = useSaveSpec();
  const { mutateAsync: deleteSpec, isPending: loadingDelete } = useDeleteSpec();
  const { control, getValues, register, reset, watch } = useForm<{
    title: string;
    status: SpecStatus;
    body: string;
  }>({
    mode: "onChange",
    resolver: valibotResolver(specEditorSchema),
    defaultValues: {
      title: doc?.title ?? "",
      status: doc?.status ?? "DRAFT",
      body: doc?.body ?? "",
    },
  });
  const status = watch("status");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedDocId = useRef<string | null>(null);

  useEffect(() => {
    if (!doc || initializedDocId.current === doc.id) return;
    reset({ title: doc.title, status: doc.status, body: doc.body });
    initializedDocId.current = doc.id;
  }, [doc, reset]);

  const scheduleSave = (patch: {
    title?: string;
    body?: string;
    status?: SpecStatus;
  }) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSpec.mutate({ path, id: docId, patch, author });
    }, 700);
  };

  const flushSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const values = getValues();
    saveSpec.mutate({
      path,
      id: docId,
      patch: values,
      author,
    });
  };

  return (
    <>
      <div
        data-drag-handle
        data-comment-no-capture=""
        className="flex cursor-move items-center justify-between gap-2 border-slate-100 border-b px-3 py-2.5"
      >
        <button
          type="button"
          onClick={() => {
            flushSave();
            onBack();
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          title="목록"
        >
          <ChevronLeftIcon className="size-4" />
        </button>
        <input
          {...register("title", {
            onChange: (e) => scheduleSave({ title: e.target.value }),
          })}
          placeholder="문서 제목"
          onBlur={flushSave}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 text-sm font-medium text-slate-900 outline-none hover:bg-slate-50 focus:bg-slate-50"
        />
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <select
              value={field.value}
              onChange={(e) => {
                const next = e.target.value as SpecStatus;
                field.onChange(next);
                saveSpec.mutate({
                  path,
                  id: docId,
                  patch: { ...getValues(), status: next },
                  author,
                });
              }}
              className={`h-7 shrink-0 rounded-full border-0 px-2 text-xs font-medium outline-none ${STATUS_BADGE[status]}`}
            >
              {(["DRAFT", "REVIEW", "CONFIRMED"] as SpecStatus[]).map((s) => (
                <option key={s} value={s}>
                  {SPEC_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          )}
        />
        <button
          type="button"
          onClick={() => {
            flushSave();
            onClose();
          }}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </button>
      </div>
      <div className="flex items-center justify-between px-4 pt-1.5 text-xs text-slate-400">
        <span>Page: {pageLabel}</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-2 py-2 text-sm leading-relaxed">
        {doc?.externalUrl && parseGoogleDocsId(doc.externalUrl) ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <iframe
              src={`https://docs.google.com/document/d/${parseGoogleDocsId(doc.externalUrl)}/preview`}
              title={doc.title || "Google Docs"}
              className="min-h-0 flex-1 rounded-lg border border-slate-200"
              style={{ width: "100%", height: "100%" }}
            />
            <a
              href={doc.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex shrink-0 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-blue-500 hover:bg-blue-50"
            >
              <ExternalLinkIcon className="size-3" />
              Google Docs에서 열기
            </a>
          </div>
        ) : (
          <Controller
            control={control}
            name="body"
            render={({ field }) => (
              <MarkdownEditor
                key={docId}
                value={field.value}
                onChange={(md) => {
                  field.onChange(md);
                  scheduleSave({ body: md });
                }}
                autoFocus={!doc?.body?.trim()}
                toolbar="full"
                placeholder="# 제목 · - 리스트 · - [ ] 할 일 · **굵게** `코드` [링크](…)"
                className="flex-1 rounded-lg border border-slate-200 focus-within:border-primary"
              />
            )}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-slate-100 border-t px-4 py-2 text-xs text-slate-400">
        <span>
          {doc?.updatedBy
            ? `최종 수정 · ${doc.updatedBy} · ${timeAgo(doc.updatedAt)}`
            : "작성 중"}
        </span>
        <button
          type="button"
          disabled={loadingDelete}
          onClick={async () => {
            await deleteSpec({ path, id: docId });
            onDeleted();
          }}
          className="flex items-center gap-1 rounded px-1.5 py-1 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
        >
          {loadingDelete ? (
            <Loader2Icon className="size-3.5 animate-spin" />
          ) : (
            <Trash2Icon className="size-3.5" />
          )}
          {loadingDelete ? "삭제 중…" : "삭제"}
        </button>
      </div>
    </>
  );
}
