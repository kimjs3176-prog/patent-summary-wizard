import { lazy, Suspense, useRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, QrCode, Download, Mail, Check, Copy } from "lucide-react";
import { ACCENT_HEX } from "./helpers";

// QR 라이브러리는 전송 창을 처음 열 때 내려받는다(요약 화면 첫 로딩을 가볍게).
const QRCodeSVG = lazy(() => import("qrcode.react").then((m) => ({ default: m.QRCodeSVG })));

const QR_SIZE = 168;

interface Props {
  shareOpen: boolean; setShareOpen: (open: boolean) => void; qrRef: React.RefObject<HTMLDivElement>; shareUrl: string; downloadQr: () => void; mailtoHref: string; copyLink: () => Promise<void>; copied: boolean;
}

/**
 * 요약서 전송 창 — Radix Dialog 위에 구성해 role="dialog"/aria-modal, 포커스 가두기,
 * Esc 닫기, 닫은 뒤 여는 버튼으로 포커스 복귀를 보장한다.
 * qrRef는 포털 안의 QR 영역을 가리키며, 창이 열려 있는 동안 downloadQr가 <svg>를 찾는다.
 */
export function ShareDialog({ shareOpen, setShareOpen, qrRef, shareUrl, downloadQr, mailtoHref, copyLink, copied }: Props) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={shareOpen} onOpenChange={setShareOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 print:hidden">
          <DialogPrimitive.Content
            // Opened from several buttons (no Dialog.Trigger), so remember the opener and hand focus back on close.
            onOpenAutoFocus={() => { returnFocusRef.current = document.activeElement as HTMLElement | null; }}
            onCloseAutoFocus={(e) => {
              const opener = returnFocusRef.current;
              returnFocusRef.current = null;
              if (opener?.isConnected) { e.preventDefault(); opener.focus(); }
            }}
            className="w-full sm:max-w-[420px] bg-white rounded-t-[24px] sm:rounded-[24px] p-6 shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-4"
          >
            <div className="flex items-center justify-between mb-5">
              <DialogPrimitive.Title className="text-[18px] font-bold text-[#191F28]">요약서 전송하기</DialogPrimitive.Title>
              <DialogPrimitive.Close asChild>
                <button
                  type="button"
                  className="w-8 h-8 rounded-full hover:bg-[#F2F4F6] flex items-center justify-center text-[#4E5968]"
                  aria-label="닫기"
                >
                  <X className="w-[18px] h-[18px]" aria-hidden="true" />
                </button>
              </DialogPrimitive.Close>
            </div>
            <DialogPrimitive.Description className="sr-only">
              QR 코드, 이메일 또는 링크 복사로 이 요약서를 공유할 수 있어요.
            </DialogPrimitive.Description>

            <div className="rounded-[16px] bg-[#F2F4F6] p-5 flex flex-col items-center mb-4">
              <p className="text-[13px] font-semibold text-[#4E5968] mb-3 flex items-center gap-1.5">
                <QrCode className="w-4 h-4" aria-hidden="true" /> 휴대폰으로 스캔하기
              </p>
              <div ref={qrRef} className="bg-white p-3 rounded-[12px]">
                <Suspense fallback={<div style={{ width: QR_SIZE, height: QR_SIZE }} className="animate-pulse rounded-md bg-[#F2F4F6]" aria-hidden="true" />}>
                  <QRCodeSVG value={shareUrl} size={QR_SIZE} level="M" role="img" aria-label="이 요약서로 연결되는 QR 코드" />
                </Suspense>
              </div>
              <p className="text-[12px] text-[#6B7684] mt-3 text-center leading-relaxed">
                카메라 앱으로 QR을 스캔하면<br />이 요약서가 바로 열려요
              </p>
              <button
                type="button"
                onClick={downloadQr}
                className="mt-3 h-9 px-4 rounded-full bg-white hover:bg-[#E5E8EB] transition-colors flex items-center gap-1.5 text-[13px] font-bold text-[#191F28]"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                QR 이미지 저장
              </button>
            </div>

            <a
              href={mailtoHref}
              className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-white mb-2"
              style={{ background: ACCENT_HEX }}
            >
              <Mail className="w-[18px] h-[18px]" aria-hidden="true" />
              이메일로 보내기
            </a>

            <button
              type="button"
              onClick={copyLink}
              className="w-full h-12 rounded-[14px] flex items-center justify-center gap-2 text-[15px] font-bold text-[#191F28] bg-[#F2F4F6] hover:bg-[#E5E8EB] transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-[18px] h-[18px]" style={{ color: ACCENT_HEX }} aria-hidden="true" />
                  <span style={{ color: ACCENT_HEX }}>링크 복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-[18px] h-[18px]" aria-hidden="true" />
                  링크 복사
                </>
              )}
            </button>
            <span className="sr-only" aria-live="polite">{copied ? "링크를 복사했어요" : ""}</span>

            <p className="text-[11px] text-[#6B7684] text-center mt-4 leading-relaxed">
              ※ 이메일 버튼은 기기의 메일 앱이 열리며,<br />수신자·내용을 확인 후 발송할 수 있어요.
            </p>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
