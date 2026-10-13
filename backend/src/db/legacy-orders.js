import { db } from './index.js';
export function recalcOrderTotals(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId); if (!order) return null;
  const items = db.prepare('SELECT price, discount FROM order_items WHERE order_id = ?').all(orderId);
  const round = (v) => Math.round((Number(v || 0) + Number.EPSILON) * 100) / 100;
  const subtotal = round(items.reduce((s, i) => s + Number(i.price || 0), 0));
  const itemDiscount = round(items.reduce((s, i) => s + Number(i.discount || 0), 0));
  const taxable = Math.max(0, subtotal - itemDiscount - Number(order.discount || 0));
  const taxAmount = round(taxable * Number(order.tax_percent || 0) / 100); const total = round(taxable + taxAmount);
  const paid = round(db.prepare('SELECT COALESCE(SUM(amount),0) AS value FROM payments WHERE order_id = ? AND is_void = 0').get(orderId).value);
  const balance = Math.max(0, round(total - paid)); const status = paid <= 0 ? 'unpaid' : balance <= 0.009 ? 'paid' : 'partial';
  db.prepare("UPDATE orders SET subtotal = ?, tax_amount = ?, total = ?, paid_amount = ?, balance = ?, payment_status = ?, updated_at = datetime('now') WHERE id = ?").run(subtotal, taxAmount, total, paid, balance, status, orderId);
  return { subtotal, itemDiscount, orderDiscount: Number(order.discount || 0), taxAmount, total, paid, balance, paymentStatus: status };
}
