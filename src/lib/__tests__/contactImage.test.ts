import { describe, it, expect } from 'vitest';
import { scaleToFit, estimateDataUrlBytes, isImageFile } from '../contactImage';

describe('scaleToFit', () => {
  it('최대 변보다 작으면 원본 크기를 유지한다', () => {
    expect(scaleToFit(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it('가로가 더 길면 가로를 최대 변에 맞춘다', () => {
    expect(scaleToFit(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
  });

  it('세로가 더 길면 세로를 최대 변에 맞춘다', () => {
    expect(scaleToFit(1000, 2000, 1024)).toEqual({ width: 512, height: 1024 });
  });
});

describe('estimateDataUrlBytes', () => {
  it('base64 길이로부터 대략적인 바이트 수를 추정한다', () => {
    // "AAAA" (4 base64 chars) ≈ 3 bytes
    expect(estimateDataUrlBytes('data:image/jpeg;base64,AAAA')).toBe(3);
  });

  it('콤마가 없으면 0을 반환한다', () => {
    expect(estimateDataUrlBytes('')).toBe(0);
  });
});

describe('isImageFile', () => {
  it('image/* MIME 타입이면 true', () => {
    expect(isImageFile({ type: 'image/png' } as unknown as File)).toBe(true);
  });

  it('이미지가 아니면 false', () => {
    expect(isImageFile({ type: 'application/pdf' } as unknown as File)).toBe(false);
  });
});
