import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SupabaseService } from '../supabase/supabase.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
// FIX 1: Correct import for sharp
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

  // HELPER: Fix Cloudinary URL for Indonesia
  private getIndonesianUrl(url: string): string {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (url.includes('res.cloudinary.com')) return url;
    return url.replace(
      'res.cloudinary.com',
      `${cloudName}-res.cloudinary.com`
    );
  }

  async generateChristmasPhoto(orderId: string, themeId: string) {
    const order = await this.supabaseService.getOrderById(orderId);

    if (!order.uploaded_photos || order.uploaded_photos.length === 0) {
      throw new Error('No uploaded photos found');
    }

    const theme = await this.supabaseService.getThemeById(themeId);

    // ANALYZE: Model Selection Strategy
    const isFamilyPhoto = order.uploaded_photos.length === 1;

    // STRATEGY: 
    // 1 Photo (Family) -> Gemini 3 Pro (Best for preserving composition)
    // Multiple Photos (Faces) -> Gemini 2.5 Flash (Efficient composition)
    const modelName = isFamilyPhoto 
      ? 'gemini-3-pro-image-preview' 
      : 'gemini-2.5-flash-image';

    const generationRecord = await this.supabaseService.saveGeneratedPhoto({
      order_id: orderId,
      theme_id: themeId,
      status: 'generating',
      generation_started_at: new Date().toISOString(),
      model_used: modelName
    });

    try {
      // 1. Prepare Inputs
      const photoInputs = await Promise.all(
        order.uploaded_photos.map(async (photo: any) => {
          const buffer = await this.cloudinaryService.downloadAsBuffer(
            photo.cloudinary_url,
          );
          return {
            inlineData: {
              data: buffer.toString('base64'),
              mimeType: 'image/jpeg',
            },
          };
        }),
      );

      // 2. Prompt Engineering based on Input Type
      let promptText = "";
      if (isFamilyPhoto) {
        promptText = `
          Transform this family photo into a ${theme.name_en} setting.
          CRITICAL: Keep the EXACT faces, body shapes, and relative heights of the people. 
          Only change the background to: ${theme.prompt}. 
          Change clothing to: Matching Indonesian Batik Christmas attire.
          Maintain high fidelity 8k photorealism.
        `;
      } else {
        promptText = `
          Create a group family photo using these faces.
          Setting: ${theme.prompt}.
          People: Compose these ${photoInputs.length} people together naturally.
          Clothing: Matching Indonesian Batik Christmas attire.
          Style: Photorealistic 8k, warm lighting.
        `;
      }

      // Generate with Gemini
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // FIX 2: Use 'any' casting or @ts-ignore to bypass strict type check for imageConfig
      const generationConfig: any = {
        imageConfig: {
          aspectRatio: "4:5", // Best for IG/Mobile
          imageSize: "2K"
        }
      };

      const result = await model.generateContent({
        contents: [
          ...photoInputs,
          { role: 'user', parts: [{ text: promptText }] },
        ],
        generationConfig: generationConfig, 
      });

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

      // Update record with Indonesian Safe URLs
      await this.supabaseService.updateGeneratedPhoto(generationRecord.id, {
        status: 'completed',
        cloudinary_url_4k: this.getIndonesianUrl(variations.url_4k),
        cloudinary_url_instagram: this.getIndonesianUrl(variations.url_instagram),
        cloudinary_url_facebook: this.getIndonesianUrl(variations.url_facebook),
        cloudinary_url_whatsapp: this.getIndonesianUrl(variations.url_whatsapp),
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

    // Process images in parallel
    const [img4k, imgInsta, imgFb, imgWa] = await Promise.all([
      sharp(imageBuffer).resize(2048, 2560).jpeg({ quality: 90 }).toBuffer(), // 4K/Print
      sharp(imageBuffer).resize(1080, 1080).jpeg({ quality: 85 }).toBuffer(), // IG Feed
      sharp(imageBuffer).resize(820, 312).jpeg({ quality: 85 }).toBuffer(),   // FB Cover
      sharp(imageBuffer).resize(1080, 1920).jpeg({ quality: 85 }).toBuffer()  // WA Story
    ]);

    // Upload all
    const [upload4k, uploadInsta, uploadFb, uploadWa] = await Promise.all([
      this.cloudinaryService.uploadImage(
        { buffer: img4k } as any,
        'generated/4k',
      ),
      this.cloudinaryService.uploadImage(
        { buffer: imgInsta } as any,
        'generated/instagram',
      ),
      this.cloudinaryService.uploadImage(
        { buffer: imgFb } as any,
        'generated/facebook',
      ),
      this.cloudinaryService.uploadImage(
        { buffer: imgWa } as any,
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