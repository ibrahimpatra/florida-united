/**
 * In-app notifications (the bell).
 *  - a customer's own messages:   users/{uid}/notifications      (order updates, returns, refunds)
 *  - the team's messages:         adminNotifications             (new order, new return request)
 *  - messages for every customer: broadcasts                     (offers, announcements written by the admin)
 * "Read" is one timestamp per person (notifState/{uid}), so marking everything read is a single write.
 * Reading costs about 25 documents; the bell asks at most every few minutes (see NotificationBell).
 * Writing a notification must never break the thing that caused it, so every writer swallows its own errors.
 */
import { getAdminDb } from './firebase-admin';
import { memo, dropMemo } from './memo';

export interface Note { id: string; type: string; title: string; titleAr?: string; body?: string; bodyAr?: string; href?: string; createdAt: string; kind?: 'mine' | 'broadcast' }
export type NoteInput = Omit<Note, 'id' | 'createdAt' | 'kind'>;

const clean = (n: NoteInput) => Object.fromEntries(Object.entries({ ...n, createdAt: new Date().toISOString() }).filter(([, v]) => v !== undefined && v !== ''));

export async function notifyUser(uid: string | undefined, n: NoteInput) {
  if (!uid) return;
  try { await getAdminDb().collection('users').doc(uid).collection('notifications').add(clean(n)); } catch (e: any) { console.error('[notify user]', e?.message); }
}
export async function notifyAdmins(n: NoteInput) {
  try { await getAdminDb().collection('adminNotifications').add(clean(n)); } catch (e: any) { console.error('[notify admins]', e?.message); }
}
export async function createBroadcast(n: NoteInput) {
  const ref = await getAdminDb().collection('broadcasts').add(clean(n));
  dropMemo('broadcasts'); return ref.id;
}
export async function deleteBroadcast(id: string) { await getAdminDb().collection('broadcasts').doc(id).delete(); dropMemo('broadcasts'); }

export async function listBroadcasts(limit = 20): Promise<Note[]> {
  return memo(`broadcasts:${limit}`, 60_000, async () => {
    const s = await getAdminDb().collection('broadcasts').orderBy('createdAt', 'desc').limit(limit).get();
    return s.docs.map((d: any) => ({ id: d.id, ...(d.data() as any), kind: 'broadcast' as const }));
  });
}

export async function listFor(uid: string, scope: 'me' | 'admin'): Promise<{ items: Note[]; readAt: string; unread: number }> {
  const db = getAdminDb();
  const stateRef = db.collection('notifState').doc(uid);
  const field = scope === 'admin' ? 'adminReadAt' : 'readAt';
  const [state, mine, bc] = await Promise.all([
    stateRef.get(),
    (scope === 'admin' ? db.collection('adminNotifications') : db.collection('users').doc(uid).collection('notifications')).orderBy('createdAt', 'desc').limit(20).get(),
    scope === 'me' ? listBroadcasts(5) : Promise.resolve([] as Note[]),
  ]);
  let readAt = (state.data() as any)?.[field] as string | undefined;
  if (!readAt) { readAt = new Date().toISOString(); try { await stateRef.set({ [field]: readAt }, { merge: true }); } catch { /* shown as unread next time */ } }   // new people start with a clean bell
  const items: Note[] = [...mine.docs.map((d: any) => ({ id: d.id, ...(d.data() as any), kind: 'mine' as const })), ...bc]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 25);
  return { items, readAt, unread: items.filter(i => String(i.createdAt) > readAt!).length };
}

export async function markAllRead(uid: string, scope: 'me' | 'admin') {
  await getAdminDb().collection('notifState').doc(uid).set({ [scope === 'admin' ? 'adminReadAt' : 'readAt']: new Date().toISOString() }, { merge: true });
}

/* ── ready-made messages ── */
const ST: Record<string, [string, string]> = {
  confirmed: ['has been confirmed', 'تم تأكيد طلبك'],
  processing: ['is being prepared', 'قيد التجهيز'],
  shipped: ['is on its way', 'تم شحن طلبك وهو في الطريق'],
  out_for_delivery: ['is out for delivery', 'طلبك خرج للتوصيل'],
  delivered: ['was delivered', 'تم تسليم طلبك'],
  cancelled: ['was cancelled', 'تم إلغاء طلبك'],
  refunded: ['was refunded', 'تم استرداد مبلغ طلبك'],
  return_approved: ['return was approved', 'تمت الموافقة على طلب الإرجاع'],
  return_rejected: ['return was declined', 'تم رفض طلب الإرجاع'],
};
export function notifyOrderStatus(order: any, status: string) {
  const s = ST[status]; if (!s || !order?.userId) return;
  const num = order.orderNumber || '';
  return notifyUser(order.userId, { type: 'order', title: `Order ${num} ${s[0]}`, titleAr: `${s[1]} (${num})`, href: `/account/orders/${order.id || ''}` });
}
export function notifyNewOrder(order: any) {
  return Promise.all([
    notifyAdmins({ type: 'order', title: `New order ${order.orderNumber || ''}`, body: `${order.userName || 'Customer'} · KWD ${Number(order.total || 0).toFixed(3)}`, href: `/admin/orders/${order.id || ''}` }),
    notifyUser(order.userId, { type: 'order', title: `We received your order ${order.orderNumber || ''}`, titleAr: `استلمنا طلبك ${order.orderNumber || ''}`, href: `/account/orders/${order.id || ''}` }),
  ]);
}
