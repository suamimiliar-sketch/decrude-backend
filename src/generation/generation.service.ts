import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseService } from '../supabase/supabase.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import sharp from 'sharp';

@Injectable()
export class GenerationService {
  private genAI: GoogleGenerativeAI;

  constructor(
    private supabaseService: SupabaseService,
    private cloudinaryService: CloudinaryService,
  ) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is not set in .env');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async generateChristmasPhoto(orderId: string, themeId: string) {
    const order = await this.supabaseService.getOrderById(orderId);

    if (!order.uploaded_photos || order.uploaded_photos.length === 0) {
      throw new Error('No uploaded photos found');
    }

    const theme = await this.supabaseService.getThemeById(themeId);

    const generationRecord = await this.supabaseService.saveGeneratedPhoto({
      order_id: orderId,
      theme_id: themeId,
      status: 'generating',
      generation_started_at: new Date().toISOString(),
    });

    try {
      // Download photos as base64
      const photoInputs = await Promise.all(
        order.uploaded_photos.map(async (photo: any) => {
          const imageBase64 = await this.cloudinaryService.downloadAsBase64(
            photo.cloudinary_url,
          );
          return {
            inlineData: {
              data: imageBase64,
              mimeType: 'image/jpeg',
            },
          };
        }),
      );

      // Generate with Gemini
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash-image',
      });

      const result = await model.generateContent([
        ...photoInputs,
        { text: theme.prompt },
      ]);

      const response = await result.response;

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates returned from model');
      }

      const parts = candidates[0].content?.parts;
      const inlineData = parts?.[0]?.inlineData?.data;

      if (!inlineData) {
        throw new Error('No image data found in model response');
      }

      const generatedImageBase64 = inlineData;

      // Upload to Cloudinary
      const uploadedImage = await this.cloudinaryService.uploadBase64Image(
        `data:image/jpeg;base64,${generatedImageBase64}`,
        'generated',
      );

      // Create variations
      const variations = await this.createImageVariations(
        uploadedImage.secure_url,
      );

      // Update record
      await this.supabaseService.updateGeneratedPhoto(generationRecord.id, {
        status: 'completed',
        cloudinary_url_4k: variations.url_4k,
        cloudinary_url_instagram: variations.url_instagram,
        cloudinary_url_facebook: variations.url_facebook,
        cloudinary_url_whatsapp: variations.url_whatsapp,
        generation_completed_at: new Date().toISOString(),
      });

      return {
        success: true,
        generationId: generationRecord.id,
        urls: variations,
      };
    } catch (error: any) {
      await this.supabaseService.updateGeneratedPhoto(generationRecord.id, {
        status: 'failed',
        error_message:
          error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async createImageVariations(originalUrl: string) {
    const imageBuffer = await this.cloudinaryService.downloadAsBuffer(
      originalUrl,
    );

    // 4K version
    const image4k = await sharp(imageBuffer)
      .resize(3000, 4000, { fit: 'cover' })
      .jpeg({ quality: 95 })
      .toBuffer();

    // Instagram
    const imageInstagram = await sharp(imageBuffer)
      .resize(1080, 1080, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Facebook
    const imageFacebook = await sharp(imageBuffer)
      .resize(820, 312, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // WhatsApp
    const imageWhatsapp = await sharp(imageBuffer)
      .resize(1080, 1920, { fit: 'cover', position: 'center' })
      .jpeg({ quality: 90 })
      .toBuffer();

    // Upload all
    const [upload4k, uploadInsta, uploadFb, uploadWa] = await Promise.all([
      this.cloudinaryService.uploadImage(
        { buffer: image4k } as any,
        'generated/4k',
      ),
      this.cloudinaryService.uploadImage(
        { buffer: imageInstagram } as any,
        'generated/instagram',
      ),
      this.cloudinaryService.uploadImage(
        { buffer: imageFacebook } as any,
        'generated/facebook',
      ),
      this.cloudinaryService.uploadImage(
        { buffer: imageWhatsapp } as any,
        'generated/whatsapp',
      ),
    ]);

    return {
      url_4k: upload4k.secure_url,
      url_instagram: uploadInsta.secure_url,
      url_facebook: uploadFb.secure_url,
      url_whatsapp: uploadWa.secure_url,
    };
  }
}
