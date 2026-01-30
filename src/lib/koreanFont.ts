// This file provides Korean font support for jsPDF
// We use multiple CDN sources for reliability

const FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/nicemoon-developer/jspdf-korean-font@main/malgun.ttf',
  'https://raw.githubusercontent.com/nicemoon-developer/jspdf-korean-font/main/malgun.ttf',
];

export async function loadKoreanFont(): Promise<string> {
  let lastError: Error | null = null;
  
  for (const fontUrl of FONT_URLS) {
    try {
      const response = await fetch(fontUrl, {
        mode: 'cors',
        cache: 'force-cache',
      });
      
      if (!response.ok) {
        throw new Error(`Font fetch failed: ${response.status}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      
      if (arrayBuffer.byteLength < 1000) {
        throw new Error('Font file too small, likely invalid');
      }
      
      const base64 = arrayBufferToBase64(arrayBuffer);
      console.log('Korean font loaded successfully from:', fontUrl);
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

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  // Process in chunks to avoid call stack issues with large fonts
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  
  return btoa(binary);
}

export function addKoreanFontToDoc(doc: any, fontBase64: string): void {
  try {
    doc.addFileToVFS('malgun.ttf', fontBase64);
    doc.addFont('malgun.ttf', 'malgun', 'normal');
    doc.setFont('malgun');
  } catch (error) {
    console.error('Failed to add font to PDF:', error);
    throw error;
  }
}
