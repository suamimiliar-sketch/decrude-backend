import { Injectable } from '@nestjs/common';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SupabaseService } from '../supabase/supabase.service';
import sharp from 'sharp';


@Injectable()
export class UploadService {
  constructor(
    private cloudinaryService: CloudinaryService,
    private supabaseService: SupabaseService,
  ) {}

  async processPhotos(files: Express.Multer.File[], orderId: string) {
    const uploadedPhotos: any[] = [];

    for (const file of files) {
      const compressedBuffer = await sharp(file.buffer)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      const cloudinaryResult = await this.cloudinaryService.uploadImage(
        { ...file, buffer: compressedBuffer },
        'uploads',
      );

      const photoRecord = await this.supabaseService.saveUploadedPhoto({
        order_id: orderId,
        cloudinary_public_id: cloudinaryResult.public_id,
        cloudinary_url: cloudinaryResult.secure_url,
        original_filename: file.originalname,
      });

      uploadedPhotos.push(photoRecord);
    }

    return {
      success: true,
      photos: uploadedPhotos,
      message: `${uploadedPhotos.length} photos uploaded successfully`,
    };
  }
}