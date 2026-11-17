import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { DomainError } from '../common/domain-error.js';
import { CreateEventDto, OwnerOrderDto } from './owner.dto.js';
import { locks } from 'node:worker_threads';
import { MAX_FAILES } from '../participant/pin.service.js';

/** 앞뒤 공백 제거 + 빈 줄 제거 */
const clean = (lines: string[]) =>
  lines.map((s) => s.trim()).filter((s) => s !== '');

@Injectable()
export class OwnerService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────── 권한 검사 (Supabase 버전의 RLS 정책이 하던 일) ─────────

  /** 내 이벤트가 맞으면 돌려주고, 없거나 남의 것이면 똑같이 404 (존재 여부를 알려주지 않는다) */
  private async ownedEvent(eventId: string, userId: string) {
    const event = await this.prisma.events.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        store_name: true,
        closed_at: true,
        owner_id: true,
      },
    });
    if (!event || event.owner_id !== userId) throw new DomainError('not_found');
    return event;
  }

  /** 내 이벤트에 속한 멤버가 맞는지 확인 */
  private async ownedMember(memberId: string, userId: string) {
    const member = await this.prisma.members.findUnique({
      where: { id: memberId },
      select: { id: true, event_id: true },
    });
    if (!member) throw new DomainError('not_found');
    await this.ownedEvent(member.event_id, userId);
    return member;
  }

  // ───────── API ─────────

  /** create_event: 이벤트 + 명단 + 메뉴를 한 트랜잭션으로 생성 */
  async createEvent(userId: string, dto: CreateEventDto) {
    const members = clean(dto.members);
    const menus = clean(dto.menus);
    if (members.length === 0 || menus.length === 0)
      throw new DomainError('empty_list');
    if (new Set(members).size !== members.length)
      throw new DomainError('duplicate_member');

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.events.create({
        data: {
          owner_id: userId,
          title: dto.title.trim(),
          store_name: dto.storeName?.trim() || null,
        },
        select: { id: true },
      });
      await tx.members.createMany({
        data: members.map((display_name) => ({
          event_id: event.id,
          display_name,
        })),
      });
      await tx.menu_items.createMany({
        data: menus.map((name) => ({ event_id: event.id, name })),
      });
      return { id: event.id };
    });
  }

  listMyEvents(userId: string) {
    return this.prisma.events.findMany({
      where: { owner_id: userId },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        title: true,
        store_name: true,
        closed_at: true,
        created_at: true,
      },
    });
  }

  /** 대시보드에 필요한 데이터 전부. pin_hash 대신 has_pin / locked만 내보낸다 */
  async getDashboard(userId: string, eventId: string) {
    const { owner_id: _ownerId, ...event } = await this.ownedEvent(
      eventId,
      userId,
    );

    const [menu, members] = await Promise.all([
      this.prisma.menu_items.findMany({
        where: { event_id: eventId },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      this.prisma.members.findMany({
        where: { event_id: eventId },
        orderBy: { display_name: 'asc' },
        select: {
          id: true,
          display_name: true,
          pin_hash: true,
          pin_fail_count: true,
        },
      }),
    ]);

    const orders = await this.prisma.orders.findMany({
      where: { member_id: { in: members.map((m) => m.id) } },
      select: {
        member_id: true,
        first_choice: true,
        alt_choice: true,
        memo: true,
      },
    });
    const orderByMember = new Map(orders.map((o) => [o.member_id, o]));

    const rows = members.map((m) => {
      const o = orderByMember.get(m.id);
      return {
        id: m.id,
        display_name: m.display_name,
        has_pin: m.pin_hash !== null,
        locked: m.pin_fail_count >= MAX_FAILES,
        order: o
          ? {
              first_choice: o.first_choice,
              alt_choice: o.alt_choice,
              memo: o.memo,
            }
          : null, // null = 미응답
      };
    });

    return { event, menu, rows };
  }

  /** 마감 / 마감 취소 */
  async setClosed(userId: string, eventId: string, closed: boolean) {
    await this.ownedEvent(eventId, userId);
    return this.prisma.events.update({
      where: { id: eventId },
      data: { closed_at: closed ? new Date() : null },
      select: { id: true, closed_at: true },
    });
  }

  /** 대리 입력/수정. 마감 후에도 가능하고 PIN이 필요 없다 */
  async saveOrder(userId: string, memberId: string, dto: OwnerOrderDto) {
    const member = await this.ownedMember(memberId, userId);

    const menuIds = [...new Set(dto.alt ? [dto.first, dto.alt] : [dto.first])];
    const found = await this.prisma.menu_items.count({
      where: { event_id: member.event_id, id: { in: menuIds } },
    });
    if (found !== menuIds.length) throw new DomainError('invalid_menu');

    const order = {
      first_choice: dto.first,
      alt_choice: dto.alt ?? null,
      memo: dto.memo ?? null,
    };
    await this.prisma.orders.upsert({
      where: { member_id: memberId },
      create: { member_id: memberId, ...order },
      update: order,
    });
    return order;
  }

  /** PIN 초기화 (잠금도 같이 풀림) */
  async resetPin(userId: string, memberId: string) {
    await this.ownedMember(memberId, userId);
    await this.prisma.members.update({
      where: { id: memberId },
      data: { pin_hash: null, pin_fail_count: 0 },
    });
  }
}
