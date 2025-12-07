import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Body,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('photos')
  @UseInterceptors(FilesInterceptor('photos', 5))
  async uploadPhotos(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('orderId') orderId: string,
  ) {
    // DEBUG LOG: Cek apakah request masuk
    console.log('📥 Request Upload Masuk!'); 
    console.log('Order ID:', orderId);
    console.log('Jumlah File:', files ? files.length : 0);

    if (!files || files.length === 0) {
      console.log('❌ Error: Tidak ada file');
      throw new BadRequestException('No files uploaded');
    }

    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 photos allowed');
    }

    // Validasi tipe file dan ukuran
    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/jpg'];
    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        console.log(`❌ Invalid File Type: ${file.mimetype}`);
        throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
      }
      if (file.size > 10 * 1024 * 1024) { // 10MB
        throw new BadRequestException(`File too large: ${file.originalname}`);
      }
    }

    return this.uploadService.processPhotos(files, orderId);
  }
}