/** 로그인 세션(JWT)을 담는 쿠키 이름 */
export const SESSION_COOKIE = 'session';

/** Cookie 요청 헤더("a=1; b=2")에서 값 하나를 꺼낸다 */
export function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  return header
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];
}
