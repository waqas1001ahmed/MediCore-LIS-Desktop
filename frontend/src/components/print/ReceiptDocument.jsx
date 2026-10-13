import { resolveAssetUrl } from '../../api/client.js';
import { formatDateTime, formatMoney, titleCase } from '../../utils/format.js';

export default function ReceiptDocument({ payload }) {
  if (!payload) return null;
  const { receipt, items, settings } = payload;
  const logo = resolveAssetUrl(settings?.lab_logo);
  const currency = {
    symbol: settings?.currency_symbol || '$',
    position: settings?.currency_position || 'before',
  };
  const money = (value) => formatMoney(value, currency);

  return (
    <article className="print-sheet receipt-sheet">
      <div className="receipt-center">
        {settings?.receipt_show_logo !== false && logo && (
          <div className="receipt-logo"><img src={logo} alt="" /></div>
        )}
        <div className="receipt-lab-name">{settings?.lab_name}</div>
        {settings?.lab_tagline && <div className="receipt-lab-sub">{settings.lab_tagline}</div>}
        {settings?.lab_address && <div className="receipt-lab-sub">{settings.lab_address}</div>}
        {settings?.lab_phone && <div className="receipt-lab-sub">{settings.lab_phone}</div>}
        <div className="receipt-title">{settings?.receipt_title || 'Payment Receipt'}</div>
      </div>

      <div className="receipt-rule" />
      <div className="receipt-kv"><span className="kv-label">Receipt</span><span className="kv-value">{receipt.receipt_no}</span></div>
      <div className="receipt-kv"><span className="kv-label">Order</span><span className="kv-value">{receipt.order_no}</span></div>
      <div className="receipt-kv"><span className="kv-label">Date</span><span className="kv-value">{formatDateTime(receipt.created_at)}</span></div>
      <div className="receipt-kv"><span className="kv-label">Patient</span><span className="kv-value">{receipt.patient_name}</span></div>
      <div className="receipt-kv"><span className="kv-label">Patient ID</span><span className="kv-value">{receipt.patient_code}</span></div>
      {receipt.doctor_name && <div className="receipt-kv"><span className="kv-label">Doctor</span><span className="kv-value">{receipt.doctor_name}</span></div>}
      <div className="receipt-rule" />

      <table className="receipt-items">
        <thead>
          <tr>
            <th>Test</th>
            <th className="num">Amt</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((item) => (
            <tr key={item.id}>
              <td className="ri-name">
                {item.test_name}
                {item.discount > 0 && <div style={{ fontSize: 9 }}>Disc -{money(item.discount)}</div>}
              </td>
              <td className="num">{money(item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="receipt-rule" />
      <div className="receipt-totals">
        <div className="receipt-total-row"><span>Subtotal</span><span>{money(receipt.subtotal)}</span></div>
        {Number(receipt.discount) > 0 && <div className="receipt-total-row"><span>Discount</span><span>-{money(receipt.discount)}</span></div>}
        {Number(receipt.tax_amount) > 0 && <div className="receipt-total-row"><span>Tax</span><span>{money(receipt.tax_amount)}</span></div>}
        <div className="receipt-total-row grand"><span>TOTAL</span><span>{money(receipt.total)}</span></div>
        <div className="receipt-total-row paid"><span>PAID ({titleCase(receipt.payment_method)})</span><span>{money(receipt.amount_paid)}</span></div>
        <div className="receipt-total-row"><span>Balance</span><span>{money(receipt.balance)}</span></div>
      </div>

      <div className="receipt-center" style={{ marginTop: 6 }}>
        <span className="receipt-badge">{receipt.status === 'void' ? 'VOID' : Number(receipt.balance) <= 0 ? 'PAID' : 'PARTIAL'}</span>
      </div>

      {receipt.reference_no && <div className="receipt-kv" style={{ marginTop: 6 }}><span className="kv-label">Ref</span><span className="kv-value">{receipt.reference_no}</span></div>}

      <div className="receipt-sign">
        <div className="sig-line">Received by<br />{receipt.received_by_name || '—'}</div>
      </div>

      {settings?.receipt_show_barcode !== false && (
        <div className="receipt-barcode">
          ||||| |||| | |||| |||||
          <div className="bc-digits">{receipt.receipt_no}</div>
        </div>
      )}

      <div className="receipt-rule" />
      <div className="receipt-footer">
        {settings?.receipt_footer}
        {settings?.invoice_terms && <div className="receipt-note" style={{ marginTop: 4 }}>{settings.invoice_terms}</div>}
      </div>
    </article>
  );
}
