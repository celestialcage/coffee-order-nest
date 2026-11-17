import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JwtGuard가 요청에 붙여주는 로그인 사용자 정보 */
export type AuthUser = { id: string; email: string };

/** 컨트롤러 인자에 @CurrentUser() user: AuthUser 로 쓴다 (Spring의 @AuthenticationPrincipal) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    context.switchToHttp().getRequest<{ user: AuthUser }>().user,
);
