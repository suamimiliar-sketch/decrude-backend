import { Injectable } from '@nestjs/common';
import { Snap } from 'midtrans-client';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PaymentService {
  private snap: Snap;

  constructor(private supabaseService: SupabaseService) {
    this.snap = new Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey: process.env.MIDTRANS_SERVER_KEY,
      clientKey: process.env.MIDTRANS_CLIENT_KEY,
    });
  }

  async createPayment(orderData: {
    email: string;
    name: string;
    packageTier: 'basic' | 'premium' | 'family';
  }) {
    // UPDATED PRICING STRATEGY (JAJAN MODEL)
    const prices = {
      basic: 10000,    // Paket Coba
      premium: 15000,  // Paket Seru
      family: 20000,   // Paket Puas
    };

    const amount = prices[orderData.packageTier];

    if (!amount) {
      throw new Error("Invalid package tier");
    }

    const order = await this.supabaseService.createOrder({
      email: orderData.email,
      package_tier: orderData.packageTier,
      amount,
      status: 'pending',
      midtrans_order_id: `DECRUDE-${Date.now()}`,
    });

    const parameter = {
      transaction_details: {
        order_id: order.midtrans_order_id,
        gross_amount: amount,
      },
      customer_details: {
        email: orderData.email,
        first_name: orderData.name,
      },
      item_details: [
        {
          id: orderData.packageTier,
          price: amount,
          quantity: 1,
          name: `DECRUDE ${orderData.packageTier.toUpperCase()} Package`,
        },
      ],
    };

    const transaction = await this.snap.createTransaction(parameter);

    return {
      orderId: order.id,
      snapToken: transaction.token,
      snapUrl: transaction.redirect_url,
    };
  }

  async handleWebhook(notification: any) {
    const orderId = notification.order_id;
    const transactionStatus = notification.transaction_status;

    const { data: orders } = await this.supabaseService
      .getClient()
      .from('orders')
      .select('*')
      .eq('midtrans_order_id', orderId);

    if (!orders || orders.length === 0) {
      throw new Error('Order not found');
    }

    const order = orders[0];
    let newStatus = order.status;

    if (transactionStatus === 'capture' || transactionStatus === 'settlement') {
      newStatus = 'paid';
    } else if (
      transactionStatus === 'cancel' ||
      transactionStatus === 'deny' ||
      transactionStatus === 'expire'
    ) {
      newStatus = 'failed';
    }

    await this.supabaseService.updateOrderStatus(order.id, newStatus, {
      midtrans_transaction_id: notification.transaction_id,
      payment_method: notification.payment_type,
      paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
    });

    return { success: true, status: newStatus };
  }
}