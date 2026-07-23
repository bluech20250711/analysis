// 듣기 디렉션 음성("N번" → "일번"/"십육번" 등)에 쓰는 한자어(sino-Korean) 숫자 읽기.
// 아라비아 숫자를 텍스트에 그대로 넣으면 TTS가 영어식으로 읽거나 어색하게 읽을 수 있어,
// 실제 수능 방송처럼 숫자를 한글로 미리 변환해 전달한다.
const SINO_KOREAN_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

// 듣기 문항 범위(1~17)만 정확하면 되지만, 십의 자리 "일십"이 아니라 관용적으로 "십"이라고
// 읽는 규칙까지 포함해 두 자리 수 전반에서 자연스럽게 동작하도록 구현했다.
export function numberToKoreanReading(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`numberToKoreanReading: 0 이상의 정수만 지원합니다 (받은 값: ${n})`);
  }
  if (n === 0) return '영';
  if (n < 10) return SINO_KOREAN_DIGITS[n];
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const ones = n % 10;
    const tensPart = tens === 1 ? '십' : `${SINO_KOREAN_DIGITS[tens]}십`;
    return ones === 0 ? tensPart : `${tensPart}${SINO_KOREAN_DIGITS[ones]}`;
  }
  throw new Error(`numberToKoreanReading: 현재 100 미만의 수만 지원합니다 (받은 값: ${n})`);
}
