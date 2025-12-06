import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { UploadModule } from './upload/upload.module';
import { GenerationModule } from './generation/generation.module';
import { PaymentModule } from './payment/payment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    CloudinaryModule,
    UploadModule,
    GenerationModule,
    PaymentModule,
  ],
})
export class AppModule {}