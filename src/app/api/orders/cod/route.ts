import { withLog } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { placeOrderHandler } from '@/lib/place-order-handler';
export const dynamic = 'force-dynamic';
async function __POST(req: NextRequest) { return placeOrderHandler(req); }

export const POST = withLog('POST', '/api/orders/cod', __POST);
