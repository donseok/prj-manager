// 명함 사진 업로드 처리: 리사이즈 + JPEG 압축 → base64 data URL

const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.8;
const MAX_BYTES = 500 * 1024; // 약 500KB

export class ImageTooLargeError extends Error {}

/** image/* MIME 타입 여부 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/** 최대 변(maxEdge)에 맞춰 비율을 유지한 목표 크기를 계산한다 */
export function scaleToFit(
  w: number,
  h: number,
  maxEdge: number,
): { width: number; height: number } {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const ratio = w > h ? maxEdge / w : maxEdge / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/** base64 data URL의 실제 바이트 수를 추정한다 */
export function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'));
    img.src = src;
  });
}

/**
 * 업로드한 이미지 File을 최대 변 maxEdge로 리사이즈하고 JPEG로 압축하여
 * base64 data URL을 반환한다. 결과가 MAX_BYTES를 초과하면 ImageTooLargeError.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<string> {
  if (!isImageFile(file)) {
    throw new Error('이미지 파일만 업로드할 수 있습니다.');
  }
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(dataUrl);
  const { width, height } = scaleToFit(img.width, img.height, maxEdge);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지 처리를 지원하지 않는 브라우저입니다.');
  ctx.drawImage(img, 0, 0, width, height);
  const result = canvas.toDataURL('image/jpeg', quality);
  if (estimateDataUrlBytes(result) > MAX_BYTES) {
    throw new ImageTooLargeError('이미지 용량이 너무 큽니다. 더 작은 사진을 사용해주세요.');
  }
  return result;
}
