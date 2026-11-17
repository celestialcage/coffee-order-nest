import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ParticipantService } from './participant.service.js';
import { SubmitOrderDto, VerifyPinDto } from './participant.dto.js';

@Controller()
export class ParticipantController {
  constructor(private readonly service: ParticipantService) {}

  @Get('events/:eventId/public')
  getEventPublic(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.service.getEventPublic(eventId);
  }

  // 조회지만 PIN을 URL에 싣지 않으려고 POST + 본문을 쓴다
  @Post('members/:memberId/order/verify')
  @HttpCode(200)
  getMyOrder(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: VerifyPinDto,
  ) {
    return this.service.getMyOrder(memberId, dto.pin);
  }

  @Put('members/:memberId/order')
  submitOrder(
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: SubmitOrderDto,
  ) {
    return this.service.submitOrder(memberId, dto);
  }
}
