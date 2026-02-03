// This file provides Korean font support for jsPDF.
// IMPORTANT: For reliability, we ship a font file in /public/fonts and fetch it locally first.

const FONT_URLS = [
  // Local (bundled) font (preferred)
  "/fonts/NotoSansKR-VF.ttf",
  // Fallbacks (may change/404 over time)
  "https://cdn.jsdelivr.net/gh/nicemoon-developer/jspdf-korean-font@main/malgun.ttf",
  "https://raw.githubusercontent.com/nicemoon-developer/jspdf-korean-font/main/malgun.ttf",
];

export async function loadKoreanFont(): Promise<string> {
  let lastError: Error | null = null;
  
  for (const fontUrl of FONT_URLS) {
    try {
      console.log('Attempting to load font from:', fontUrl);
      const response = await fetch(fontUrl);
      
      if (!response.ok) {
        throw new Error(`Font fetch failed: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength < 1000) {
        throw new Error('Font file too small, likely invalid');
      }
      
      // Use a more robust base64 encoding method
      const base64 = await arrayBufferToBase64Async(arrayBuffer);
      console.log('Korean font loaded successfully from:', fontUrl, 'Size:', arrayBuffer.byteLength);
      return base64;
    } catch (error) {
      console.warn('Failed to load font from:', fontUrl, error);
      lastError = error as Error;
      continue;
    }
  }
  
  console.error('All font sources failed');
  throw lastError || new Error('Failed to load Korean font from all sources');
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

export function addKoreanFontToDoc(doc: any, fontBase64: string): void {
  try {
    // Register font with medium weight for better readability
    doc.addFileToVFS('NotoSansKR-Medium.ttf', fontBase64);
    doc.addFont('NotoSansKR-Medium.ttf', 'NotoSansKR', 'normal', 500);
    doc.setFont('NotoSansKR', 'normal');
    console.log('Korean font added to PDF document');
  } catch (error) {
    console.error('Failed to add font to PDF:', error);
    throw error;
  }
}
