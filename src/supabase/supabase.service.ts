import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!url || !serviceKey) {
      throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY is not set in .env');
    }

    this.supabase = createClient(url, serviceKey);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  async createOrder(orderData: any) {
    const { data, error } = await this.supabase
      .from('orders')
      .insert(orderData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getOrderById(orderId: string) {
    const { data, error } = await this.supabase
      .from('orders')
      .select('*, uploaded_photos(*), generated_photos(*)')
      .eq('id', orderId)
      .single();
    if (error) throw error;
    return data;
  }

  async updateOrderStatus(orderId: string, status: string, updates: any = {}) {
    const { data, error } = await this.supabase
      .from('orders')
      .update({ status, ...updates })
      .eq('id', orderId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async saveUploadedPhoto(photoData: any) {
    const { data, error } = await this.supabase
      .from('uploaded_photos')
      .insert(photoData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async saveGeneratedPhoto(photoData: any) {
    const { data, error } = await this.supabase
      .from('generated_photos')
      .insert(photoData)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateGeneratedPhoto(photoId: string, updates: any) {
    const { data, error } = await this.supabase
      .from('generated_photos')
      .update(updates)
      .eq('id', photoId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async getThemeById(themeId: string) {
    const { data, error } = await this.supabase
      .from('themes')
      .select('*')
      .eq('id', themeId)
      .single();
    if (error) throw error;
    return data;
  }

  async getAllThemes() {
    const { data, error } = await this.supabase
      .from('themes')
      .select('*')
      .order('id');
    if (error) throw error;
    return data;
  }
}
