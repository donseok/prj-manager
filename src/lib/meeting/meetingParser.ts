import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// PDF.js 워커 설정 — CDN에서 동일 버전의 워커를 로드
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ── Types ──────────────────────────────────────────────────────

export interface ParsedMeeting {
  /** 추출된 전체 텍스트 */
  text: string;
  /** 원본 파일명 */
  fileName: string;
  /** 파일 형식 */
  fileType: 'pdf' | 'txt' | 'docx';
}

type SupportedExtension = 'pdf' | 'txt' | 'docx';

const SUPPORTED_EXTENSIONS = new Set<string>(['pdf', 'txt', 'docx']);

// ── Public API ─────────────────────────────────────────────────

/**
 * 업로드된 파일(PDF, TXT, DOCX)에서 텍스트를 추출합니다.
 */
export async function parseMeetingFile(file: File): Promise<ParsedMeeting> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (!SUPPORTED_EXTENSIONS.has(ext)) {
    throw new Error(
      `지원하지 않는 파일 형식입니다: .${ext}\n지원 형식: PDF, TXT, DOCX`,
    );
  }

  const fileType = ext as SupportedExtension;

  switch (fileType) {
    case 'txt':
      return parseTxt(file);
    case 'docx':
      return parseDocx(file);
    case 'pdf':
      return parsePdf(file);
  }
}

// ── TXT Parser ─────────────────────────────────────────────────

async function parseTxt(file: File): Promise<ParsedMeeting> {
  try {
    const text = await file.text();
    return { text: text.trim(), fileName: file.name, fileType: 'txt' };
  } catch {
    throw new Error('텍스트 파일을 읽는 중 오류가 발생했습니다.');
  }
}

// ── DOCX Parser (mammoth) ──────────────────────────────────────

async function parseDocx(file: File): Promise<ParsedMeeting> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    if (!result.value.trim()) {
      throw new Error('DOCX 파일에서 텍스트를 찾을 수 없습니다.');
    }

    return { text: result.value.trim(), fileName: file.name, fileType: 'docx' };
  } catch (err) {
    if (err instanceof Error && err.message.includes('텍스트를 찾을 수 없습니다')) {
      throw err;
    }
    throw new Error(
      'DOCX 파일을 처리하는 중 오류가 발생했습니다. 파일이 손상되었거나 올바른 형식이 아닐 수 있습니다.',
    );
  }
}

// ── PDF Parser (pdfjs-dist) ────────────────────────────────────

async function parsePdf(file: File): Promise<ParsedMeeting> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);

    const pdf = await pdfjs.getDocument({ data: typedArray }).promise;
    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .filter((item): item is TextItem => 'str' in item)
        .map((item) => item.str)
        .join(' ');
      pageTexts.push(pageText);
    }

    const text = pageTexts.join('\n').trim();

    if (!text) {
      throw new Error(
        'PDF 파일에서 텍스트를 추출할 수 없습니다. 스캔된 이미지 PDF일 수 있습니다.',
      );
    }

    return { text, fileName: file.name, fileType: 'pdf' };
  } catch (err) {
    if (err instanceof Error && err.message.includes('텍스트를 추출할 수 없습니다')) {
      throw err;
    }
    throw new Error(
      'PDF 파일을 처리하는 중 오류가 발생했습니다. 파일이 손상되었거나 올바른 형식이 아닐 수 있습니다.',
    );
  }
}
