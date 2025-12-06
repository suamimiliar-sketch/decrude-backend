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
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 photos allowed');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/heic'];
    for (const file of files) {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new BadRequestException(`Invalid file type: ${file.mimetype}`);
      }
      if (file.size > 10 * 1024 * 1024) {
        throw new BadRequestException(`File too large: ${file.originalname}`);
      }
    }

    return this.uploadService.processPhotos(files, orderId);
  }
}