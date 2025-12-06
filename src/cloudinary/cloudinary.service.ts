import { Injectable } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import * as https from 'https';

@Injectable()
export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async uploadImage(file: Express.Multer.File, folder: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder: `decrude/${folder}`, resource_type: 'image' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        },
      );
      uploadStream.end(file.buffer);
    });
  }

  async uploadBase64Image(base64: string, folder: string): Promise<any> {
    return cloudinary.uploader.upload(base64, {
      folder: `decrude/${folder}`,
      resource_type: 'image',
    });
  }

  async downloadAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.toString('base64'));
        });
        response.on('error', reject);
      });
    });
  }

  async downloadAsBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      });
    });
  }
}