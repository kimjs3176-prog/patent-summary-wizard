import type { jsPDF } from "jspdf";

// Korean font support for jsPDF.
// Only the font bundled in /public/fonts (Noto Sans KR, SIL OFL) is used: no third-party
// font hosts, so the PDF never depends on (or leaks requests to) an external repository.

const FONT_URL = "/fonts/NotoSansKR-VF.ttf";

// The font is ~10 MB; fetch and base64-encode it once per page session.
let fontPromise: Promise<string> | null = null;

async function fetchKoreanFont(): Promise<string> {
  const response = await fetch(FONT_URL);
  if (!response.ok) {
    throw new Error(`Font fetch failed: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength < 1000) {
    throw new Error("Font file too small, likely invalid");
  }
  return arrayBufferToBase64Async(arrayBuffer);
}

export function loadKoreanFont(): Promise<string> {
  if (!fontPromise) {
    fontPromise = fetchKoreanFont().catch((error) => {
      // Allow a later click to retry after a transient failure.
      fontPromise = null;
      throw error;
    });
  }
  return fontPromise;
}

// Async version for better handling of large fonts
async function arrayBufferToBase64Async(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([buffer], { type: 'font/ttf' });
      const reader = new FileReader();
      
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Remove the data URL prefix to get just the base64
        const base64 = dataUrl.split(',')[1];
        if (base64) {
          resolve(base64);
        } else {
          reject(new Error('Failed to extract base64 from data URL'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('FileReader error during base64 conversion'));
      };
      
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
}

export function addKoreanFontToDoc(doc: jsPDF, fontBase64: string): void {
  try {
    // Register font with medium weight for better readability
    doc.addFileToVFS('NotoSansKR-Medium.ttf', fontBase64);

    // jsPDF v4: addFont(fileName, fontName, fontStyle)
    // (Passing a weight here can prevent proper registration and lead to garbled text.)
    doc.addFont('NotoSansKR-Medium.ttf', 'NotoSansKR', 'normal');

    // Ensure the font is available before setting it.
    const fontList = typeof doc.getFontList === 'function' ? doc.getFontList() : null;
    const hasFont = !!(fontList && (fontList.NotoSansKR || fontList["NotoSansKR"]));

    if (!hasFont) {
      console.warn('NotoSansKR font not found in getFontList(); falling back to setFont without style');
      doc.setFont('NotoSansKR');
    } else {
      doc.setFont('NotoSansKR', 'normal');
    }

  } catch (error) {
    console.error('Failed to add font to PDF:', error);
    throw error;
  }
}
