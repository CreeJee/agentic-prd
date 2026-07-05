import { valibotResolver } from "@hookform/resolvers/valibot";
import { Controller, useForm } from "react-hook-form";
import * as v from "valibot";
import { Button } from "@/components/ui/button";
import type { Point } from "../anchor";
import { MarkdownEditor } from "./MarkdownEditor";
import { PointPopover } from "./PointPopover";

const formSchema = v.object({
  text: v.pipe(v.string(), v.trim(), v.nonEmpty("코멘트 내용을 입력하세요.")),
});

/**
 * 신규 코멘트 작성 팝오버 — 임시 핀 + 마크다운 본문. Cmd/Ctrl+Enter로 제출.
 * 작성자(닉네임)는 툴바에서 미리 설정한다(닉네임 없으면 코멘트 진입 자체가 막힘).
 */
export function DraftComposer({
  point,
  onCancel,
  onSubmit,
}: {
  point: Point;
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const {
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<{ text: string }>({
    mode: "onChange",
    resolver: valibotResolver(formSchema),
    defaultValues: { text: "" },
  });
  const submit = handleSubmit(({ text }) => onSubmit(text));

  return (
    <>
      <div
        style={{ left: point.x, top: point.y }}
        className="-translate-x-1 -translate-y-7 pointer-events-none absolute size-7 rounded-full rounded-bl-none border-2 border-white bg-primary shadow-md"
      />
      <PointPopover point={point} className="flex w-80 flex-col gap-2 p-3">
        <div className="flex flex-col gap-1">
          <Controller
            control={control}
            name="text"
            render={({ field }) => (
              <MarkdownEditor
                value={field.value}
                onChange={field.onChange}
                onSubmit={submit}
                autoFocus
                placeholder="코멘트를 입력하세요…"
                className="max-h-40 min-h-16 rounded-lg border border-slate-200 focus-within:border-primary"
              />
            )}
          />
          {errors.text?.message && (
            <p className="px-1 text-red-500 text-xs">{errors.text.message}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-slate-500 hover:bg-slate-50"
          >
            취소
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            disabled={!isValid}
            onClick={submit}
          >
            코멘트
          </Button>
        </div>
      </PointPopover>
    </>
  );
}
