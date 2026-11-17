import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '../auth/jwt.guard.js';
import { OwnerService } from './owner.service.js';
import { type AuthUser, CurrentUser } from '../auth/auth-user.js';
import { CreateEventDto, OwnerOrderDto, SetClosedDto } from './owner.dto.js';

@Controller()
@UseGuards(JwtGuard) // 이 컨트롤러의 모든 API는 로그인 필요
export class OwnerController {
  constructor(private readonly service: OwnerService) {}

  @Post('events')
  createEvent(@CurrentUser() user: AuthUser, @Body() dto: CreateEventDto) {
    return this.service.createEvent(user.id, dto);
  }

  @Get('events')
  listMyEvents(@CurrentUser() user: AuthUser) {
    return this.service.listMyEvents(user.id);
  }

  @Get('events/:eventId/dashboard')
  getDashboard(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.service.getDashboard(user.id, eventId);
  }

  @Patch('events/:eventId')
  setClosed(
    @CurrentUser() user: AuthUser,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: SetClosedDto,
  ) {
    return this.service.setClosed(user.id, eventId, dto.closed);
  }

  @Put('owner/members/:memberId/order')
  saveOrder(
    @CurrentUser() user: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: OwnerOrderDto,
  ) {
    return this.service.saveOrder(user.id, memberId, dto);
  }

  @Delete('owner/members/:memberId/pin')
  @HttpCode(204)
  resetPin(
    @CurrentUser() user: AuthUser,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.service.resetPin(user.id, memberId);
  }
}
