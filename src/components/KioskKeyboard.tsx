import { useEffect, useRef, useState, useCallback } from "react";
import Hangul from "hangul-js";
import { X, Delete, CornerDownLeft, ChevronUp } from "lucide-react";
import { useKioskMode } from "@/hooks/useKioskMode";

type Layout = "ko" | "en" | "num";

const KO_ROWS = [
  ["ㅂ","ㅈ","ㄷ","ㄱ","ㅅ","ㅛ","ㅕ","ㅑ","ㅐ","ㅔ"],
  ["ㅁ","ㄴ","ㅇ","ㄹ","ㅎ","ㅗ","ㅓ","ㅏ","ㅣ"],
  ["ㅋ","ㅌ","ㅊ","ㅍ","ㅠ","ㅜ","ㅡ"],
];
const KO_SHIFT: Record<string, string> = { "ㅂ":"ㅃ","ㅈ":"ㅉ","ㄷ":"ㄸ","ㄱ":"ㄲ","ㅅ":"ㅆ","ㅐ":"ㅒ","ㅔ":"ㅖ" };

const EN_ROWS = [
  ["q","w","e","r","t","y","u","i","o","p"],
  ["a","s","d","f","g","h","j","k","l"],
  ["z","x","c","v","b","n","m"],
];

const NUM_ROWS = [
  ["1","2","3","4","5","6","7","8","9","0"],
  ["-","_","@",".","/",",","?","!"],
  ["(",")","[","]","#","%","&","*"],
];

function isEditable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const t = (el as HTMLInputElement).type;
  return ["text","search","email","tel","url","password","number",""].includes(t || "");
}

export function KioskKeyboard() {
  const { enabled } = useKioskMode();
  const [target, setTarget] = useState<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [layout, setLayout] = useState<Layout>("ko");
  const [shift, setShift] = useState(false);
  // composing hangul jamos (for current syllable being built)
  const composingRef = useRef<string[]>([]);
  const lastTargetRef = useRef<HTMLElement | null>(null);

  // Track focused input
  useEffect(() => {
    if (!enabled) {
      setTarget(null);
      composingRef.current = [];
      return;
    }
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as Element;
      if (isEditable(el) && !el.closest("[data-kiosk-keyboard]")) {
        setTarget(el);
        lastTargetRef.current = el;
        composingRef.current = [];
      }
    };
    const onFocusOut = (e: FocusEvent) => {
      // Don't hide if focus moves into the keyboard itself
      const next = e.relatedTarget as Element | null;
      if (next && (next as HTMLElement).closest?.("[data-kiosk-keyboard]")) return;
      composingRef.current = [];
    };
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [enabled]);

  const setValue = useCallback((el: HTMLInputElement | HTMLTextAreaElement, value: string, caret: number) => {
    const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    setter?.call(el, value);
    el.setSelectionRange(caret, caret);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const insertText = useCallback((text: string) => {
    const el = target;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const newVal = el.value.slice(0, start) + text + el.value.slice(end);
    setValue(el, newVal, start + text.length);
  }, [target, setValue]);

  const replaceLastChar = useCallback((newChar: string) => {
    const el = target;
    if (!el) return;
    const caret = el.selectionStart ?? el.value.length;
    const newVal = el.value.slice(0, caret - 1) + newChar + el.value.slice(caret);
    setValue(el, newVal, caret - 1 + newChar.length);
  }, [target, setValue]);

  const pressJamo = useCallback((jamo: string) => {
    if (!target) return;
    target.focus();
    const buf = composingRef.current;
    if (buf.length === 0) {
      composingRef.current = [jamo];
      insertText(jamo);
      return;
    }
    const tentative = [...buf, jamo];
    const assembled = Hangul.assemble(tentative);
    if (assembled.length === 1) {
      composingRef.current = tentative;
      replaceLastChar(assembled);
    } else {
      // Composition broke: keep first composed syllable, start new buffer
      const firstChar = assembled[0];
      const restJamos = Hangul.disassemble(assembled.slice(1));
      // Replace current composing syllable with firstChar
      replaceLastChar(firstChar);
      // Insert remaining as new composition
      composingRef.current = restJamos;
      insertText(Hangul.assemble(restJamos));
    }
  }, [target, insertText, replaceLastChar]);

  const pressBackspace = useCallback(() => {
    const el = target;
    if (!el) return;
    el.focus();
    composingRef.current = [];
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === end) {
      if (start === 0) return;
      const newVal = el.value.slice(0, start - 1) + el.value.slice(end);
      setValue(el, newVal, start - 1);
    } else {
      const newVal = el.value.slice(0, start) + el.value.slice(end);
      setValue(el, newVal, start);
    }
  }, [target, setValue]);

  const pressEnter = useCallback(() => {
    const el = target;
    if (!el) return;
    composingRef.current = [];
    el.focus();
    if (el.tagName === "TEXTAREA") {
      insertText("\n");
    } else {
      // Submit parent form
      const form = (el as HTMLInputElement).form;
      if (form) {
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
      } else {
        el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
        el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
      }
    }
  }, [target, insertText]);

  const pressNonJamo = useCallback((char: string) => {
    composingRef.current = [];
    target?.focus();
    insertText(char);
  }, [target, insertText]);

  if (!enabled || !target) return null;

  const renderKey = (label: string, onClick: () => void, opts?: { flex?: number; variant?: "default" | "alt"; wide?: boolean }) => (
    <button
      key={label + Math.random()}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`h-12 md:h-14 rounded-xl font-medium text-base md:text-lg select-none transition-all active:scale-95 ${
        opts?.variant === "alt"
          ? "bg-muted text-foreground hover:bg-muted/80"
          : "bg-card text-foreground border border-border/60 hover:bg-accent/30"
      }`}
      style={{ flex: opts?.flex ?? 1, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}
    >
      {label}
    </button>
  );

  const rows = layout === "ko" ? KO_ROWS : layout === "en" ? EN_ROWS : NUM_ROWS;

  return (
    <div
      data-kiosk-keyboard
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-background/95 backdrop-blur-xl shadow-2xl animate-fade-up"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="max-w-4xl mx-auto px-2 md:px-4 py-2 md:py-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex gap-1">
            {(["ko","en","num"] as Layout[]).map((l) => (
              <button
                key={l}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { setLayout(l); composingRef.current = []; }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${layout === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
              >
                {l === "ko" ? "한글" : l === "en" ? "ABC" : "123"}
              </button>
            ))}
          </div>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { composingRef.current = []; (target as HTMLElement).blur(); setTarget(null); }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
            aria-label="키보드 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-1.5 md:space-y-2">
          {rows.map((row, idx) => (
            <div key={idx} className="flex gap-1 md:gap-1.5" style={{ paddingInline: idx === 1 && layout !== "num" ? "2%" : 0 }}>
              {layout === "ko" && idx === 2 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShift((s) => !s)}
                  className={`h-12 md:h-14 rounded-xl font-medium text-sm transition-all active:scale-95 ${shift ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                  style={{ flex: 1.5 }}
                  aria-label="쉬프트"
                >
                  <ChevronUp className="w-4 h-4 mx-auto" />
                </button>
              )}
              {layout === "en" && idx === 2 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShift((s) => !s)}
                  className={`h-12 md:h-14 rounded-xl font-medium text-sm transition-all active:scale-95 ${shift ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                  style={{ flex: 1.5 }}
                >
                  <ChevronUp className="w-4 h-4 mx-auto" />
                </button>
              )}
              {row.map((k) => {
                let label = k;
                if (layout === "ko" && shift && KO_SHIFT[k]) label = KO_SHIFT[k];
                if (layout === "en" && shift) label = k.toUpperCase();
                return renderKey(label, () => {
                  if (layout === "ko") pressJamo(label);
                  else pressNonJamo(label);
                  if (shift && layout === "en") setShift(false);
                });
              })}
              {(layout === "ko" || layout === "en") && idx === 2 && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={pressBackspace}
                  className="h-12 md:h-14 rounded-xl font-medium bg-muted text-foreground transition-all active:scale-95"
                  style={{ flex: 1.5 }}
                  aria-label="지우기"
                >
                  <Delete className="w-5 h-5 mx-auto" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-1 md:gap-1.5">
            {renderKey("-", () => pressNonJamo("-"), { variant: "alt", flex: 1 })}
            {renderKey("space", () => pressNonJamo(" "), { variant: "alt", flex: 5 })}
            {layout === "num" && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={pressBackspace}
                className="h-12 md:h-14 rounded-xl font-medium bg-muted text-foreground transition-all active:scale-95"
                style={{ flex: 1.5 }}
              >
                <Delete className="w-5 h-5 mx-auto" />
              </button>
            )}
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={pressEnter}
              className="h-12 md:h-14 rounded-xl font-semibold bg-primary text-primary-foreground transition-all active:scale-95 flex items-center justify-center gap-1"
              style={{ flex: 1.8 }}
            >
              <CornerDownLeft className="w-4 h-4" />
              <span className="text-sm">입력</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}