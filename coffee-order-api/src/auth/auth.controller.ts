import { Controller, Get, Query, Req, Res, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { JwtGuard } from './jwt.guard.js';
import { type AuthUser, CurrentUser } from './auth-user.js';

const STATE_COOKIE = 'oauth_state';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** 프론트의 "Google로 로그인" 버튼이 이 주소로 이동시킨다 */
  @Get('google')
  start(@Res() res: Response) {
    // state: 이 브라우저가 시작한 로그인인지 콜백에서 확인하기 위한 임의 값 (CSRF 방지)
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(this.auth.googleAuthUrl(state));
  }

  /** Google이 로그인 후 사용자를 이 주소로 돌려보낸다 (?code=...&state=...) */
  @Get('google/callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const front = this.config.getOrThrow<string>('FRONT_URL');
    const savedState = readCookie(req.headers.cookie, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE);

    if (!code || !state || state !== savedState) {
      return res.redirect(`${front}/auth/callback#error=login_failed`);
    }
    try {
      const token = await this.auth.loginWithGoogleCode(code);
      // #뒤(fragment)는 서버로 전송되지 않아서 서버 로그에 토큰이 남지 않는다
      return res.redirect(`${front}/auth/callback#token=${token}`);
    } catch {
      return res.redirect(`${front}/auth/callback#error=login_failed`);
    }
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}

function readCookie(
  header: string | undefined,
  name: string,
): string | undefined {
  return header
    ?.split(';')
    .map((part) => part.trim().split('='))
    .find(([key]) => key === name)?.[1];
}
