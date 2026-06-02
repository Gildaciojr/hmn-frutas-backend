import 'dotenv/config';

import { join } from 'path';

import { NestFactory } from '@nestjs/core';

import { ValidationPipe } from '@nestjs/common';

import { NestExpressApplication } from '@nestjs/platform-express';

import { AppModule } from './app.module';

import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  ////////////////////////////////////////////////////////////
  // 🌐 STATIC FILES
  ////////////////////////////////////////////////////////////

  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  ////////////////////////////////////////////////////////////
  // 🌐 CORS
  ////////////////////////////////////////////////////////////

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  ////////////////////////////////////////////////////////////
  // 🧠 VALIDAÇÃO GLOBAL
  ////////////////////////////////////////////////////////////

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,

      forbidNonWhitelisted: true,

      transform: true,
    }),
  );

  ////////////////////////////////////////////////////////////
  // 📦 PADRÃO DE RESPOSTA
  ////////////////////////////////////////////////////////////

  app.useGlobalInterceptors(new ResponseInterceptor());

  ////////////////////////////////////////////////////////////
  // 🔧 PREFIXO GLOBAL
  ////////////////////////////////////////////////////////////

  app.setGlobalPrefix('api');

  ////////////////////////////////////////////////////////////
  // 🚀 START
  ////////////////////////////////////////////////////////////

  await app.listen(process.env.PORT ?? 3000);

  console.log(
    `🚀 API rodando em http://localhost:${process.env.PORT ?? 3000}/api`,
  );

  console.log(
    `🖼️ Uploads disponíveis em http://localhost:${process.env.PORT ?? 3000}/uploads`,
  );
}

bootstrap();
