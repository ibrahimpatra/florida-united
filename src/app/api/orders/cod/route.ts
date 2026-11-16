import { NextRequest } from 'next/server';
import { placeOrderHandler } from '@/lib/place-order-handler';
export const dynamic = 'force-dynamic';
export async function POST(req: NextRequest) { return placeOrderHandler(req); }
