import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // FIX: Enable CORS agar Frontend (Port 3001) bisa akses Backend (Port 3000)
  app.enableCors({
    origin: true, // Mengizinkan semua origin (untuk development)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(3000);
  console.log('🚀 Backend running on http://localhost:3000');
}
bootstrap();