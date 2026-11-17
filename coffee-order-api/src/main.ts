import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // DTO의 검증 데코레이터를 실제로 적용. whitelist: DTO에 없는 필드는 버린다
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  // // 프론트(다른 주소)에서 호출할 수 있게 허용. 쉼표로 여러 개 지정 가능
  // app.enableCors({
  //   origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','),
  // });

  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
