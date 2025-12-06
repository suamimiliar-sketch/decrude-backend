import { NestApplication, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  await app.listen(3000);
  console.log('🚀 Backend running on http://localhost:3000');
}
bootstrap();