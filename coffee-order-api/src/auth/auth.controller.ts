import { randomBytes } from 'node:crypto';
import {
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';
import { readCookie, SESSION_COOKIE } from '../common/cookies.js';
import { type AuthUser, CurrentUser } from './auth-user.js';
import { AuthService } from './auth.service.js';
import { JwtGuard } from './jwt.guard.js';

const STATE_COOKIE = 'oauth_state';
const TEN_MINUTES = 10 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // JWT 유효기간(7d)과 맞춘다

@Controller('auth')
export class AuthController {
  private readonly front: string;

  constructor(
    private readonly auth: AuthService,
    config: ConfigService,
  ) {
    this.front = config.getOrThrow<string>('FRONT_URL');
  }

  /**
   * httpOnly: 자바스크립트가 읽을 수 없다 (XSS로 토큰을 훔칠 수 없음)
   * sameSite lax: 다른 사이트가 보낸 POST/PUT/DELETE 요청에는 쿠키가 안 붙는다 (CSRF 방어)
   * secure: https에서만 전송 (로컬 개발은 http라서 끈다)
   */
  private cookieOptions(maxAge: number): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.front.startsWith('https'),
      path: '/',
      maxAge,
    };
  }

  /** 프론트의 "Google로 로그인" 버튼이 이 주소로 이동시킨다 */
  @Get('google')
  start(@Res() res: Response) {
    // state: 이 브라우저가 시작한 로그인인지 콜백에서 확인하기 위한 임의 값 (CSRF 방지)
    const state = randomBytes(16).toString('hex');
    res.cookie(STATE_COOKIE, state, this.cookieOptions(TEN_MINUTES));
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
    const savedState = readCookie(req.headers.cookie, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: '/' });

    if (!code || !state || state !== savedState) {
      return res.redirect(`${this.front}/?login=failed`);
    }
    try {
      const token = await this.auth.loginWithGoogleCode(code);
      res.cookie(SESSION_COOKIE, token, this.cookieOptions(SEVEN_DAYS));
      return res.redirect(`${this.front}/`);
    } catch {
      return res.redirect(`${this.front}/?login=failed`);
    }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  @UseGuards(JwtGuard)
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }
}
