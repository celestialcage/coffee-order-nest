import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import bcrypt from 'bcryptjs';

export const MAX_FAILES = 5;

export type PinStatus = 'ok' | 'unset' | 'wrong_pin' | 'locked' | 'not_found';

/** Supabase 버전의 check_pin 함수에 해당 */
@Injectable()
export class PinService {
  constructor(private readonly prisma: PrismaService) {}

  async check(memberId: string, pin: string): Promise<PinStatus> {
    const member = await this.prisma.members.findUnique({
      where: { id: memberId },
      select: { pin_hash: true, pin_fail_count: true },
    });
    if (!member) return 'not_found';
    if (member.pin_hash === null) return 'unset';
    if (member.pin_fail_count >= MAX_FAILES) return 'locked';

    if (await bcrypt.compare(pin, member.pin_hash)) {
      if (member.pin_fail_count > 0) {
        await this.prisma.members.update({
          where: { id: memberId },
          data: { pin_fail_count: 0 },
        });
      }
      return 'ok';
    }

    // increment는 DB에서 "값 = 값 + 1"로 실행돼서 동시에 틀려도 횟수가 누락되지 않는다
    await this.prisma.members.update({
      where: { id: memberId },
      data: { pin_fail_count: { increment: 1 } },
    });
    return 'wrong_pin';
  }

  hash(pin: string) {
    return bcrypt.hash(pin, 10);
  }
}
