import { describe, it, expect } from 'vitest';
import { sanitizeProgressInput, parseProgressInput, clampProgress } from '../progress';

describe('sanitizeProgressInput', () => {
  it('숫자가 아닌 문자는 버린다', () => {
    expect(sanitizeProgressInput('4a2b')).toBe('42');
    expect(sanitizeProgressInput('-42')).toBe('42');
    expect(sanitizeProgressInput('42%')).toBe('42');
  });

  it('타이핑 도중의 소수점("42.")을 지우지 않는다', () => {
    expect(sanitizeProgressInput('42.')).toBe('42.');
  });

  it('소수점 첫째 자리까지만 남긴다', () => {
    expect(sanitizeProgressInput('42.37')).toBe('42.3');
    expect(sanitizeProgressInput('42.3.7')).toBe('42.3');
  });

  it('소수점으로 시작하면 0 을 채운다', () => {
    expect(sanitizeProgressInput('.5')).toBe('0.5');
  });

  it('100 을 넘으면 100 으로 자른다', () => {
    expect(sanitizeProgressInput('120')).toBe('100');
    expect(sanitizeProgressInput('100.5')).toBe('100');
  });

  it('빈 문자열은 그대로 둔다 (전체 삭제 후 재입력 허용)', () => {
    expect(sanitizeProgressInput('')).toBe('');
  });
});

describe('parseProgressInput', () => {
  it('소수점 첫째 자리 숫자로 변환한다', () => {
    expect(parseProgressInput('42.5')).toBe(42.5);
    expect(parseProgressInput('42.')).toBe(42);
    expect(parseProgressInput('42.46')).toBe(42.5);
  });

  it('빈 문자열·비정상 입력은 0 으로 처리한다', () => {
    expect(parseProgressInput('')).toBe(0);
    expect(parseProgressInput('abc')).toBe(0);
  });

  it('0~100 범위를 벗어나지 않는다', () => {
    expect(parseProgressInput('150')).toBe(100);
    expect(parseProgressInput('-10')).toBe(0);
  });
});

describe('clampProgress', () => {
  it('범위를 벗어난 값과 NaN 을 방어한다', () => {
    expect(clampProgress(42.5)).toBe(42.5);
    expect(clampProgress(101)).toBe(100);
    expect(clampProgress(-1)).toBe(0);
    expect(clampProgress(NaN)).toBe(0);
  });
});
