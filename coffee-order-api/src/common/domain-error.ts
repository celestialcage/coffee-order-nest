import { HttpException } from '@nestjs/common';

/** 업무 규칙 실패 코드 → HTTP 상태코드. 프론트 api.ts의 RpcError와 같은 이름을 쓴다 */
const STATUS = {
  not_found: 404,
  wrong_pin: 401,
  locked: 423,
  closed: 409,
  unset: 409,
  invalid_menu: 422,
  duplicate_member: 409,
  empty_list: 400,
} as const;

export type ErrorCode = keyof typeof STATUS;

/** 응답 본문: { "error": "wrong_pin" } */
export class DomainError extends HttpException {
  constructor(code: ErrorCode) {
    super({ error: code }, STATUS[code]);
  }
}
