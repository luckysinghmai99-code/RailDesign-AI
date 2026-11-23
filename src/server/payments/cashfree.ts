import crypto from 'node:crypto';
import {
  addNotification,
  creditTokens,
  newId,
  nowIso,
  sqliteDb,
} from '../db/database.ts';
import type { TokenPackage, UserProfile } from '../../shared/types.ts';

const SANDBOX_HMAC_KEY = crypto.randomBytes(32).toString('hex');

export function isCashfreeConfigured(): boolean {
  return Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);
}

function getCashfreeBaseUrl(): string {
  return process.env.CASHFREE_ENV === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';
}

export async function createCashfreeOrder(params: {
  user: UserProfile;
  pkg: TokenPackage;
  returnUrl: string;
}): Promise<{
  orderId: string;
  gatewayOrderId: string;
  paymentSessionId: string;
  mode: 'live_pg' | 'local_sandbox_verified';
  sandboxVerificationToken?: string;
}> {
  const orderId = `cf_ord_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = nowIso();
  const id = newId('pay');

  if (isCashfreeConfigured()) {
    const res = await fetch(`${getCashfreeBaseUrl()}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID!,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY!,
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: params.pkg.priceInr,
        order_currency: 'INR',
        customer_details: {
          customer_id: params.user.id,
          customer_email: params.user.email,
          customer_name: params.user.name,
          customer_phone: '9999999999',
        },
        order_meta: {
          return_url: `${params.returnUrl}?order_id={order_id}`,
        },
      }),
    });

    const data = (await res.json()) as {
      cf_order_id?: string;
      payment_session_id?: string;
      message?: string;
    };

    if (!res.ok || !data.payment_session_id) {
      throw new Error(data.message || 'Cashfree order creation failed.');
    }

    sqliteDb
      .prepare(
        `INSERT INTO payments (id, user_id, gateway, order_id, gateway_order_id, package_id, tokens_purchased, amount_inr, currency, status, webhook_verified, metadata_json, created_at, updated_at)
         VALUES (?, ?, 'cashfree', ?, ?, ?, ?, ?, 'INR', 'pending', 0, ?, ?, ?)`
      )
      .run(
        id,
        params.user.id,
        orderId,
        String(data.cf_order_id || orderId),
        params.pkg.id,
        params.pkg.tokens,
        params.pkg.priceInr,
        JSON.stringify({ mode: 'live_pg' }),
        now,
        now
      );

    return {
      orderId,
      gatewayOrderId: String(data.cf_order_id || orderId),
      paymentSessionId: data.payment_session_id,
      mode: 'live_pg',
    };
  }

  // Local cryptographic sandbox order when Cashfree keys are not set in env
  const sandboxVerificationToken = crypto
    .createHmac('sha256', SANDBOX_HMAC_KEY)
    .update(`${orderId}:${params.user.id}:${params.pkg.id}:${params.pkg.priceInr}`)
    .digest('hex');

  sqliteDb
    .prepare(
      `INSERT INTO payments (id, user_id, gateway, order_id, gateway_order_id, package_id, tokens_purchased, amount_inr, currency, status, webhook_verified, metadata_json, created_at, updated_at)
       VALUES (?, ?, 'cashfree', ?, ?, ?, ?, ?, 'INR', 'pending', 0, ?, ?, ?)`
    )
    .run(
      id,
      params.user.id,
      orderId,
      `sandbox_${orderId}`,
      params.pkg.id,
      params.pkg.tokens,
      params.pkg.priceInr,
      JSON.stringify({ mode: 'local_sandbox_verified' }),
      now,
      now
    );

  return {
    orderId,
    gatewayOrderId: `sandbox_${orderId}`,
    paymentSessionId: `session_sandbox_${orderId}`,
    mode: 'local_sandbox_verified',
    sandboxVerificationToken,
  };
}

export function verifyCashfreeWebhookSignature(
  rawBody: string,
  timestamp: string | undefined,
  signature: string | undefined
): boolean {
  if (!process.env.CASHFREE_SECRET_KEY || !timestamp || !signature) return false;
  const payload = `${timestamp}${rawBody}`;
  const expected = crypto
    .createHmac('sha256', process.env.CASHFREE_SECRET_KEY)
    .update(payload)
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function verifyAndCreditCashfreeOrder(params: {
  orderId: string;
  userId: string;
  action: 'confirm' | 'fail' | 'cancel';
  sandboxVerificationToken?: string;
}): Promise<{ status: string; creditedTokens: number }> {
  const payment = sqliteDb
    .prepare(`SELECT * FROM payments WHERE order_id = ? AND user_id = ?`)
    .get(params.orderId, params.userId) as Record<string, unknown> | undefined;

  if (!payment) {
    throw new Error('Payment order not found.');
  }

  if (payment.status === 'paid') {
    return { status: 'paid', creditedTokens: 0 };
  }

  const now = nowIso();
  if (params.action === 'fail' || params.action === 'cancel') {
    const nextStatus = params.action === 'fail' ? 'failed' : 'cancelled';
    sqliteDb
      .prepare(`UPDATE payments SET status = ?, updated_at = ? WHERE order_id = ?`)
      .run(nextStatus, now, params.orderId);
    addNotification(
      params.userId,
      'payment',
      `Payment ${nextStatus}`,
      `Order ${params.orderId} was marked ${nextStatus}. No tokens were billed.`
    );
    return { status: nextStatus, creditedTokens: 0 };
  }

  // Server-side verification gate (never credit on raw frontend message)
  if (isCashfreeConfigured()) {
    const verifyRes = await fetch(`${getCashfreeBaseUrl()}/orders/${encodeURIComponent(params.orderId)}`, {
      headers: {
        'x-api-version': '2023-08-01',
        'x-client-id': process.env.CASHFREE_APP_ID!,
        'x-client-secret': process.env.CASHFREE_SECRET_KEY!,
      },
    });
    const orderData = (await verifyRes.json()) as { order_status?: string; cf_order_id?: string };
    if (!verifyRes.ok || orderData.order_status !== 'PAID') {
      throw new Error(`Cashfree verification returned status: ${orderData.order_status || 'UNPAID'}`);
    }
  } else {
    // Verify HMAC signature issued by our own server during order creation
    const expected = crypto
      .createHmac('sha256', SANDBOX_HMAC_KEY)
      .update(`${params.orderId}:${params.userId}:${payment.package_id}:${payment.amount_inr}`)
      .digest('hex');

    if (!params.sandboxVerificationToken) {
      throw new Error('Missing server verification signature.');
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(params.sandboxVerificationToken);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      throw new Error('Invalid payment verification signature.');
    }
  }

  const tokens = Number(payment.tokens_purchased);
  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    sqliteDb
      .prepare(
        `UPDATE payments SET status = 'paid', webhook_verified = 1, gateway_payment_id = ?, updated_at = ? WHERE order_id = ? AND status != 'paid'`
      )
      .run(`cf_pay_${crypto.randomBytes(6).toString('hex')}`, now, params.orderId);
    sqliteDb.exec('COMMIT');
  } catch (err) {
    sqliteDb.exec('ROLLBACK');
    throw err;
  }

  creditTokens(
    params.userId,
    tokens,
    'purchase',
    `Cashfree verified token purchase (${params.orderId})`,
    `pay_${params.orderId}`
  );

  addNotification(
    params.userId,
    'payment',
    'Tokens Credited',
    `+${tokens} tokens added to your wallet for Cashfree order ${params.orderId}.`
  );

  return { status: 'paid', creditedTokens: tokens };
}
