import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly supabaseService: SupabaseService,
  ) {}

  @Post('create')
  async createPayment(@Body() orderData: any) {
    return this.paymentService.createPayment(orderData);
  }

  @Post('webhook')
  async handleWebhook(@Body() notification: any) {
    return this.paymentService.handleWebhook(notification);
  }

  @Get('orders/:id')
async getOrder(@Param('id') id: string) {
  return this.supabaseService.getOrderById(id);
}
}