// This file provides Korean font support for jsPDF
// We use a CDN approach to fetch the font dynamically

export async function loadKoreanFont(): Promise<string> {
  // Use Noto Sans KR Regular from Google Fonts CDN
  // This is a subset font that supports common Korean characters
  const fontUrl = 'https://cdn.jsdelivr.net/gh/nicemoon-developer/jspdf-korean-font@main/malgun.ttf';
  
  try {
    const response = await fetch(fontUrl);
    if (!response.ok) {
      throw new Error('Font fetch failed');
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    return base64;
  } catch (error) {
    console.error('Failed to load Korean font:', error);
    throw error;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function addKoreanFontToDoc(doc: any, fontBase64: string): void {
  doc.addFileToVFS('malgun.ttf', fontBase64);
  doc.addFont('malgun.ttf', 'malgun', 'normal');
  doc.setFont('malgun');
}
