import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';

type GoogleProfile = { sub: string; email: string; name?: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  /** 1단계: 사용자를 보낼 Google 로그인 화면 주소 */
  googleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
      redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  /** 2단계: Google이 돌려준 code로 사용자를 확인하고 우리 서비스의 JWT를 발급 */
  async loginWithGoogleCode(code: string): Promise<string> {
    const profile = await this.fetchGoogleProfile(code);

    // google_sub(Google의 고유 사용자 번호)으로 찾고, 없으면 새로 만든다
    const user = await this.prisma.users.upsert({
      where: { google_sub: profile.sub },
      update: { email: profile.email, name: profile.name ?? null },
      create: {
        google_sub: profile.sub,
        email: profile.email,
        name: profile.name ?? null,
      },
    });

    return this.jwt.signAsync({ sub: user.id, email: user.email });
  }

  async me(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async fetchGoogleProfile(code: string): Promise<GoogleProfile> {
    // code → access_token 교환. client_secret이 필요해서 서버에서만 할 수 있다
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.getOrThrow<string>('GOOGLE_CLIENT_ID'),
        client_secret: this.config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
        redirect_uri: this.config.getOrThrow<string>('GOOGLE_REDIRECT_URI'),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok)
      throw new UnauthorizedException('google token exchange failed');
    const { access_token } = (await tokenRes.json()) as {
      access_token: string;
    };

    // access_token으로 사용자 정보 조회
    const profileRes = await fetch(
      'https://openidconnect.googleapis.com/v1/userinfo',
      { headers: { Authorization: `Bearer ${access_token}` } },
    );
    if (!profileRes.ok)
      throw new UnauthorizedException('google userinfo failed');
    return (await profileRes.json()) as GoogleProfile;
  }
}
