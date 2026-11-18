export type ProviderId = 'stripe' | 'tap' | 'myfatoorah';
export const PROVIDER_IDS: ProviderId[] = ['stripe', 'tap', 'myfatoorah'];

export interface PayOrder {
  id: string; orderNumber: string; total: number; // KWD, always read from the saved order
  userEmail?: string; contactEmail?: string; userName?: string; phone?: string;
  paymentRef?: string; stripeSessionId?: string;
}
export interface StartResult { url: string; ref: string; extra?: Record<string, any> }
export interface VerifyResult { paid: boolean; failed?: boolean; ref?: string; amount?: number; currency?: string; extra?: Record<string, any> }

export interface PaymentProvider {
  id: ProviderId;
  name: string;
  /** The currency the customer is charged in. */
  currency: 'KWD' | 'USD';
  /** True when the secret keys are present in the server environment. */
  configured(): boolean;
  start(order: PayOrder, ctx: { appUrl: string; returnUrl: string; cancelUrl: string; db?: any }): Promise<StartResult>;
  /** Ask the provider (server to server) whether this order was paid. Never trust browser parameters. */
  verify(order: PayOrder, hint?: string): Promise<VerifyResult>;
}
