import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "../../src/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../src/components/ui/select";
import { CommentWidget } from "../../src";

/**
 * 위젯 앵커 동작을 시험하기 위한 키친싱크 페이지.
 * Base UI Dialog(role="dialog", trigger에 aria-controls 자동 부여), 그 안에 Base UI Select(중첩 오버레이),
 * 네이티브 select, 긴 스크롤 영역, position:fixed 패널을 모두 담는다.
 */
export function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* fixed 패널 — 스크롤해도 고정. 핀이 fixed 영역에서도 따라붙는지 시험 */}
      <aside className="fixed top-4 left-4 z-10 w-44 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="font-semibold text-sm">고정 패널</p>
        <p className="mt-1 text-slate-500 text-xs" data-testid="fixed-note">
          position: fixed
        </p>
      </aside>

      <main className="mx-auto max-w-2xl px-6 py-10 pl-52">
        <h1 className="font-bold text-2xl">Comment Widget Playground</h1>
        <p className="mt-2 text-slate-600 text-sm">
          오른쪽 아래 툴바가 위젯입니다. 아래 요소들에 코멘트를 달아 앵커 동작을
          시험하세요.
        </p>

        <section className="mt-8 flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger className="rounded-lg bg-slate-900 px-4 py-2 font-medium text-sm text-white hover:bg-slate-700">
              Dialog 열기
            </DialogTrigger>
            <DialogContent className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 w-96 rounded-xl bg-white p-5 shadow-xl">
              <DialogTitle className="font-semibold text-lg">
                예제 다이얼로그
              </DialogTitle>
              <DialogDescription className="mt-1 text-slate-500 text-sm">
                이 안의 필드와 Select에 코멘트를 달아보세요.
              </DialogDescription>

              <label
                className="mt-4 block font-medium text-sm"
                data-testid="dialog-name-label"
              >
                이름
                <input
                  className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                  placeholder="이름 입력"
                />
              </label>

              {/* 중첩 오버레이: Dialog 안의 Base UI Select (M2 N중 trigger 시험용) */}
              <div className="mt-4">
                <p className="font-medium text-sm">통화(중첩 Select)</p>
                <Select>
                  <SelectTrigger className="mt-1 inline-flex w-full items-center justify-between rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent className="z-[60] rounded-lg border border-slate-200 bg-white shadow-lg">
                    {["KRW", "USD", "JPY"].map((c) => (
                      <SelectItem
                        key={c}
                        value={c}
                        className="cursor-pointer rounded px-3 py-1.5 text-sm data-highlighted:bg-slate-100"
                      >
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 중첩 오버레이: Dialog 안의 또 다른 Dialog (Dialog→Dialog 체인 시험용) */}
              <div className="mt-4">
                <Dialog>
                  <DialogTrigger className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white">
                    안쪽 다이얼로그 열기
                  </DialogTrigger>
                  <DialogContent className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-[56] w-80 rounded-xl bg-white p-5 shadow-xl">
                    <DialogTitle className="font-semibold text-base">
                      안쪽 다이얼로그
                    </DialogTitle>
                    <DialogDescription className="mt-1 text-slate-500 text-sm">
                      이 안의 메모에 코멘트를 달면 Dialog→Dialog 2단 체인이
                      된다.
                    </DialogDescription>
                    <label
                      className="mt-3 block font-medium text-sm"
                      data-testid="inner-memo-label"
                    >
                      메모
                      <input
                        className="mt-1 block w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                        placeholder="메모 입력"
                      />
                    </label>
                  </DialogContent>
                </Dialog>
              </div>

              <DialogClose className="mt-5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm hover:bg-slate-200">
                닫기
              </DialogClose>
            </DialogContent>
          </Dialog>

          <label className="text-sm" data-testid="native-select-label">
            네이티브 select{" "}
            <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm">
              <option>A</option>
              <option>B</option>
            </select>
          </label>
        </section>

        {/* 긴 스크롤 영역 — 스크롤 시 핀이 요소를 따라붙는지 시험 */}
        <section className="mt-8">
          <h2 className="font-semibold text-sm">긴 목록 (스크롤 추종 시험)</h2>
          <ul className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {Array.from({ length: 40 }, (_, i) => (
              <li
                key={i}
                className="px-4 py-3 text-sm"
                data-testid={`row-${i}`}
              >
                항목 {i + 1}
              </li>
            ))}
          </ul>
        </section>
      </main>

      <CommentWidget
        config={{
          storage: {
            url: "https://rcspbbhdwffpnimefyeu.supabase.co",
            publicKey: "sb_publishable_1xY8wrIcq36-nf4DULOWGg_o2NTWzdJ",
          },
        }}
      />
    </div>
  );
}
