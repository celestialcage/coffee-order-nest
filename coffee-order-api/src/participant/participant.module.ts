import { Module } from '@nestjs/common';
import { ParticipantController } from './participant.controller.js';
import { ParticipantService } from './participant.service.js';
import { PinService } from './pin.service.js';

@Module({
  controllers: [ParticipantController],
  providers: [ParticipantService, PinService],
  exports: [PinService],
})
export class ParticipantModule {}
