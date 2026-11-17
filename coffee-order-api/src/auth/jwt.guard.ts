import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthUser } from './auth-user.js';
import type { Request } from 'express';
import { readCookie, SESSION_COOKIE } from '../common/cookies.js';

/** Authorization: Bearer <토큰> 헤더를 검증한다 (Spring Security의 JWT 필터에 해당) */
@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    // canActivate 안에서 아래 두 줄을
    //   const [type, token] = req.headers.authorization?.split(' ') ?? [];
    //   if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    // 이렇게 교체
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException();

    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      req.user = { id: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException(); // 서명 불일치, 만료 등
    }
    return true;
  }
}
