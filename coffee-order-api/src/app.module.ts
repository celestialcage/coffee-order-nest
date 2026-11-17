import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ParticipantModule } from './participant/participant.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OwnerModule } from './owner/owner.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ParticipantModule,
    OwnerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
