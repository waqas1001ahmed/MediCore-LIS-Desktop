import { resolveAssetUrl } from '../../api/client.js';
import { ageLabel, formatDateTime, titleCase } from '../../utils/format.js';

function flagClass(flag) {
  if (!flag) return '';
  return `is-${flag}`;
}

const ORG_KIND_LABEL = {
  hospital: 'Hospital',
  laboratory: 'Laboratory',
  clinic: 'Clinic',
  organization: 'Organization',
};

export function resolveReportOrgHeader(settings) {
  const name = String(settings?.report_org_name || '').trim();
  if (!settings?.report_org_enabled || !name) return null;
  const kind = ORG_KIND_LABEL[settings.report_org_kind] || 'Organization';
  return { kind, name };
}

export default function ReportDocument({ payload, compact = false, showHeader = true, showFooter = true }) {
  if (!payload) return null;
  const { report, order, patient, doctor, items, settings } = payload;
  const logo = resolveAssetUrl(settings?.lab_logo);
  const orgHeader = resolveReportOrgHeader(settings);
  const grouped = [];
  for (const item of items || []) {
    const key = item.category_name || 'General';
    const last = grouped[grouped.length - 1];
    if (!last || last.category !== key) grouped.push({ category: key, items: [item] });
    else last.items.push(item);
  }

  const watermark = report.status === 'draft' ? 'DRAFT' : report.status === 'amended' ? 'AMENDED' : '';

  return (
    <article className={`print-sheet report-sheet ${compact ? '' : ''}${showHeader ? '' : ' report-sheet--no-header'}`}>
      {watermark && (
        <div className="report-watermark"><span>{watermark}</span></div>
      )}
      {showHeader && (
        <div className="report-branding-header">
          <header className="report-header">
            {orgHeader && (
              <div className="report-org-banner">
                <span className="report-org-kind">{orgHeader.kind}</span>
                <span className="report-org-name">{orgHeader.name}</span>
              </div>
            )}
            {settings?.report_show_logo !== false && (
              <div className="report-logo">
                {logo ? <img src={logo} alt="" /> : <div className="report-logo-placeholder">{(settings?.lab_name || 'LAB').slice(0, 2).toUpperCase()}</div>}
              </div>
            )}
            <div className="report-lab">
              <div className="report-lab-name">{settings?.lab_name}</div>
              {settings?.lab_tagline && <div className="report-lab-tagline">{settings.lab_tagline}</div>}
              <div className="report-lab-meta">
                {settings?.lab_address && <span>{settings.lab_address}</span>}
                {settings?.lab_phone && <span>{settings.lab_phone}</span>}
                {settings?.lab_email && <span>{settings.lab_email}</span>}
                {settings?.lab_license && <span>Reg. {settings.lab_license}</span>}
              </div>
            </div>
            <div className="report-header-right">
              <div className="rh-label">Report No</div>
              <div className="rh-value">{report.report_no}</div>
              <div className="rh-label" style={{ marginTop: 6 }}>Order No</div>
              <div className="rh-value">{order?.order_no}</div>
            </div>
          </header>

          <div className="report-title-band">{settings?.report_title || 'Laboratory Investigation Report'}</div>
          {settings?.report_header && <p style={{ textAlign: 'center', fontSize: 10, marginTop: 6, color: '#475569' }}>{settings.report_header}</p>}
        </div>
      )}

      <section className="report-patient">
        <div className="report-patient-col">
          <div className="report-patient-row"><div className="rp-label">Patient</div><div className="rp-value">{patient?.full_name}</div></div>
          <div className="report-patient-row"><div className="rp-label">Patient ID</div><div className="rp-value">{patient?.patient_code}</div></div>
          <div className="report-patient-row"><div className="rp-label">Age / Sex</div><div className="rp-value">{ageLabel(patient?.age, patient?.age_unit)} / {titleCase(patient?.gender)}</div></div>
          <div className="report-patient-row"><div className="rp-label">Phone</div><div className="rp-value">{patient?.phone || '—'}</div></div>
        </div>
        <div className="report-patient-col">
          <div className="report-patient-row"><div className="rp-label">Referring doctor</div><div className="rp-value">{doctor?.name || 'Walk-in'}</div></div>
          <div className="report-patient-row"><div className="rp-label">Collected</div><div className="rp-value">{formatDateTime(report.sample_collected_at || order?.sample_collected_at)}</div></div>
          <div className="report-patient-row"><div className="rp-label">Reported</div><div className="rp-value">{formatDateTime(report.reported_at || report.created_at)}</div></div>
          <div className="report-patient-row"><div className="rp-label">Status</div><div className="rp-value">{titleCase(report.status)}</div></div>
        </div>
      </section>

      <section className="report-results">
        <table>
          <thead>
            <tr>
              <th>Investigation</th>
              <th>Result</th>
              <th>Unit</th>
              <th>Reference range</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((group) => (
              <>
                <tr key={`cat-${group.category}`}>
                  <td colSpan={5} className="rc-cat">{group.category}</td>
                </tr>
                {group.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="rc-test">{item.test_name}</div>
                      <div className="rc-code">{item.test_code}{item.method ? ` · ${item.method}` : ''}</div>
                      {item.remarks && <div className="rc-remark">{item.remarks}</div>}
                    </td>
                    <td className="rc-result">{item.result_value || '—'}</td>
                    <td>{item.result_unit || ''}</td>
                    <td className="rc-reference">{item.reference_range || '—'}</td>
                    <td className={`rc-flag ${flagClass(item.flag)}`}>{item.flag && item.flag !== 'normal' ? item.flag : item.flag === 'normal' ? 'N' : ''}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </section>

      {(report.conclusion || report.remarks || settings?.report_verified_note) && (
        <section className="report-notes">
          <div className="report-note-box">
            <div className="rn-title">Interpretation / conclusion</div>
            <div className="rn-body">{report.conclusion || '—'}</div>
          </div>
          <div className="report-note-box">
            <div className="rn-title">Remarks</div>
            <div className="rn-body">{report.remarks || settings?.report_verified_note || '—'}</div>
          </div>
        </section>
      )}

      {showFooter && (
        <div className="report-footer-block">
          <section className="report-signatures">
            <div className="report-sign">
              <div className="sign-line" />
              <div className="sign-name">{report.created_by_name || 'Technologist'}</div>
              <div className="sign-role">Reported by</div>
            </div>
            <div className="report-sign">
              <div className="sign-line" />
              <div className="sign-name">{report.verified_by_name || '—'}</div>
              <div className="sign-role">Verified by</div>
            </div>
            <div className="report-sign">
              <div className="sign-line" />
              <div className="sign-name">{settings?.report_authorized_name || 'Pathologist'}</div>
              <div className="sign-role">{settings?.report_authorized_title || 'Authorised signatory'}</div>
            </div>
          </section>

          <footer className="report-footer">
            <div className="rf-note">{settings?.report_footer}</div>
            <div className="rf-page">{report.report_no}</div>
          </footer>
        </div>
      )}
    </article>
  );
}
