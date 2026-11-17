import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PinService } from './pin.service.js';
import { DomainError } from '../common/domain-error.js';
import { SubmitOrderDto } from './participant.dto.js';

@Injectable()
export class ParticipantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pin: PinService,
  ) {}

  /** get_event_public: 참여자 화면에 필요한 공개 정보 (pin_hash는 내보내지 않는다) */
  async getEventPublic(eventId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
    });
    if (!event) throw new DomainError('not_found');

    const [members, menu] = await Promise.all([
      this.prisma.members.findMany({
        where: { event_id: eventId },
        orderBy: { display_name: 'asc' },
        select: { id: true, display_name: true, pin_hash: true },
      }),
      this.prisma.menu_items.findMany({
        where: { event_id: eventId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

    return {
      id: event.id,
      title: event.title,
      store_name: event.store_name,
      closed: event.closed_at !== null,
      members: members.map((m) => ({
        id: m.id,
        display_name: m.display_name,
        has_pin: m.pin_hash !== null,
      })),
      menu,
    };
  }

  /** get_my_order: PIN 확인 + 내 주문 조회 */
  async getMyOrder(memberId: string, pin: string) {
    const status = await this.pin.check(memberId, pin);
    if (status !== 'ok') throw new DomainError(status);

    const member = await this.prisma.members.findUnique({
      where: { id: memberId },
      select: { event_id: true },
    });
    if (!member) throw new DomainError('not_found');

    const [event, order] = await Promise.all([
      this.prisma.events.findUnique({
        where: { id: member.event_id },
        select: { closed_at: true },
      }),
      this.prisma.orders.findUnique({
        where: { member_id: memberId },
        select: { first_choice: true, alt_choice: true, memo: true },
      }),
    ]);

    return { closed: event?.closed_at != null, order };
  }

  /** submit_order: 주문 제출/수정. 최초 제출이면 이때 넘긴 PIN이 그 사람의 PIN이 된다 */
  async submitOrder(memberId: string, dto: SubmitOrderDto) {
    const member = await this.prisma.members.findUnique({
      where: { id: memberId },
      select: { event_id: true },
    });
    if (!member) throw new DomainError('not_found');

    const event = await this.prisma.events.findUnique({
      where: { id: member.event_id },
      select: { closed_at: true },
    });
    if (event?.closed_at != null) throw new DomainError('closed');

    // 고른 메뉴가 전부 이 이벤트의 메뉴인지 확인
    const menuIds = [...new Set(dto.alt ? [dto.first, dto.alt] : [dto.first])];
    const found = await this.prisma.menu_items.count({
      where: { event_id: member.event_id, id: { in: menuIds } },
    });
    if (found !== menuIds.length) throw new DomainError('invalid_menu');

    const status = await this.pin.check(memberId, dto.pin);
    if (status !== 'ok' && status !== 'unset') throw new DomainError(status);

    const order = {
      first_choice: dto.first,
      alt_choice: dto.alt ?? null,
      memo: dto.memo ?? '',
    };
    const newHash = status === 'unset' ? await this.pin.hash(dto.pin) : null;

    // PIN 설정과 주문 저장은 한 트랜잭션: 둘 다 되거나 둘 다 안 된다
    await this.prisma.$transaction(async (tx) => {
      if (newHash) {
        // "PIN이 아직 없는 경우에만" 설정한다. 0건이면 그 사이 다른 사람이 먼저 설정한 것
        const claimed = await tx.members.updateMany({
          where: { id: memberId, pin_hash: null },
          data: { pin_hash: newHash },
        });
        if (claimed.count === 0) throw new DomainError('wrong_pin');
      }
      await tx.orders.upsert({
        where: { member_id: memberId },
        create: { member_id: memberId, ...order },
        update: order,
      });
    });

    return order;
  }
}
