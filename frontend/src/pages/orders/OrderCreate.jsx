import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, apiError } from '../../api/client.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useFetch } from '../../hooks/useApi.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useSettings } from '../../context/SettingsContext.jsx';
import { PageHeader } from '../../components/PageHeader.jsx';
import {
  Alert, Badge, Button, Card, CardBody, CardHeader, Checkbox, EmptyState, Field, Input,
  SearchInput, Select, TableShell, Textarea,
} from '../../components/ui/index.jsx';
import { PAYMENT_METHOD_OPTIONS, PRIORITY_OPTIONS } from '../../utils/constants.js';
import { formatMoney } from '../../utils/format.js';

export default function OrderCreate() {
  const navigate = useNavigate();
  const toast = useToast();
  const { currency, settings } = useSettings();
  const [params] = useSearchParams();
  const [patientSearch, setPatientSearch] = useState('');
  const [patientId, setPatientId] = useState(params.get('patient_id') || '');
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState('routine');
  const [sampleCollected, setSampleCollected] = useState(false);
  const [sampleType, setSampleType] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(settings?.tax_percent || 0);
  const [items, setItems] = useState([]);
  const [testSearch, setTestSearch] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('cash');
  const [payRef, setPayRef] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const debouncedPatient = useDebounce(patientSearch, 250);
  const debouncedTest = useDebounce(testSearch, 200);

  const { data: patients } = useFetch(async () => {
    const { data: payload } = await api.get('/patients', { params: { search: debouncedPatient, limit: 8 } });
    return payload.data;
  }, [debouncedPatient]);

  const { data: doctors } = useFetch(async () => {
    const { data: payload } = await api.get('/doctors/options');
    return payload.data;
  }, []);

  const { data: tests } = useFetch(async () => {
    const { data: payload } = await api.get('/tests/options');
    return payload.data;
  }, []);

  const selectedPatient = (patients || []).find((p) => String(p.id) === String(patientId));

  const filteredTests = useMemo(() => {
    const term = debouncedTest.trim().toLowerCase();
    return (tests || []).filter((test) => {
      if (!term) return true;
      return test.name.toLowerCase().includes(term) || test.code.toLowerCase().includes(term) || (test.category_name || '').toLowerCase().includes(term);
    });
  }, [tests, debouncedTest]);

  const addTest = (test) => {
    if (items.some((item) => item.test_id === test.id)) return;
    setItems((current) => [...current, { test_id: test.id, code: test.code, name: test.name, category: test.category_name, price: Number(test.price), discount: 0 }]);
  };

  const updateItem = (testId, patch) => {
    setItems((current) => current.map((item) => (item.test_id === testId ? { ...item, ...patch } : item)));
  };

  const removeItem = (testId) => setItems((current) => current.filter((item) => item.test_id !== testId));

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0), 0);
  const itemDiscount = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const taxable = Math.max(0, subtotal - itemDiscount - Number(discount || 0));
  const taxAmount = (taxable * Number(taxPercent || 0)) / 100;
  const total = taxable + taxAmount;

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    if (!patientId) {
      setError('Select a patient.');
      return;
    }
    if (!items.length) {
      setError('Add at least one test.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        patient_id: Number(patientId),
        doctor_id: doctorId || undefined,
        priority,
        sample_collected: sampleCollected,
        sample_type: sampleType || undefined,
        clinical_notes: notes || undefined,
        discount: Number(discount || 0),
        tax_percent: Number(taxPercent || 0),
        items: items.map((item) => ({ test_id: item.test_id, price: item.price, discount: item.discount })),
      };
      const paid = Number(payAmount || 0);
      if (paid > 0) payload.payment = { amount: paid, method: payMethod, reference_no: payRef || undefined };
      const { data: created } = await api.post('/orders', payload);
      toast.success('Order created', created.data.order.order_no);
      if (created.receipt_id) {
        navigate(`/receipts/${created.receipt_id}/print`);
      } else {
        navigate(`/orders/${created.data.order.id}`);
      }
    } catch (saveError) {
      setError(apiError(saveError, 'Unable to create order'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        icon="clipboard"
        title="New test order"
        subtitle="Select a patient, add tests and optionally collect a deposit."
        actions={<Button variant="ghost" icon="arrow-left" onClick={() => navigate('/orders')}>Cancel</Button>}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={submit} className="grid" style={{ gap: 20 }}>
        <div className="grid grid-2">
          <Card>
            <CardHeader title="Patient" />
            <CardBody>
              <Field label="Search patient">
                <SearchInput value={patientSearch} onChange={setPatientSearch} placeholder="Name, ID or phone" />
              </Field>
              <div className="catalog-list mt-3">
                {(patients || []).map((patient) => (
                  <button
                    type="button"
                    key={patient.id}
                    className={`catalog-item ${String(patient.id) === String(patientId) ? 'is-added' : ''}`}
                    onClick={() => {
                      setPatientId(patient.id);
                      if (patient.referred_by) setDoctorId(patient.referred_by);
                    }}
                  >
                    <span className="flex-1">
                      <span className="fw-550" style={{ display: 'block' }}>{patient.full_name}</span>
                      <span className="text-xs text-subtle">{patient.patient_code} · {patient.phone || 'no phone'}</span>
                    </span>
                    {String(patient.id) === String(patientId) && <Badge tone="success">Selected</Badge>}
                  </button>
                ))}
              </div>
              {selectedPatient && (
                <p className="text-sm text-muted mt-3">Selected {selectedPatient.full_name} ({selectedPatient.patient_code})</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Order details" />
            <CardBody>
              <div className="form-grid">
                <Field label="Referring doctor">
                  <Select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    options={[{ value: '', label: 'Walk-in / none' }, ...(doctors || []).map((doc) => ({ value: doc.id, label: doc.name }))]}
                  />
                </Field>
                <Field label="Priority">
                  <Select value={priority} options={PRIORITY_OPTIONS} onChange={(e) => setPriority(e.target.value)} />
                </Field>
                <Field label="Sample type">
                  <Input value={sampleType} onChange={(e) => setSampleType(e.target.value)} placeholder="Blood, urine…" />
                </Field>
                <Field label="Order discount">
                  <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                </Field>
                <Field label="Tax %">
                  <Input type="number" min="0" step="0.01" value={taxPercent} onChange={(e) => setTaxPercent(e.target.value)} />
                </Field>
                <Field label="Clinical notes" className="span-full">
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
                <Field className="span-full">
                  <Checkbox label="Sample already collected" checked={sampleCollected} onChange={(e) => setSampleCollected(e.target.checked)} />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid grid-2">
          <Card>
            <CardHeader title="Test catalogue" />
            <CardBody>
              <SearchInput value={testSearch} onChange={setTestSearch} placeholder="Search tests…" />
              <div className="catalog-list mt-3">
                {filteredTests.slice(0, 40).map((test) => {
                  const added = items.some((item) => item.test_id === test.id);
                  return (
                    <button type="button" key={test.id} className={`catalog-item ${added ? 'is-added' : ''}`} disabled={added} onClick={() => addTest(test)}>
                      <span className="flex-1">
                        <span className="fw-550" style={{ display: 'block' }}>{test.name}</span>
                        <span className="text-xs text-subtle">{test.code} · {test.category_name || 'Uncategorised'}</span>
                      </span>
                      <span className="fw-650">{formatMoney(test.price, currency)}</span>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <Card className="card-flush">
            <CardHeader title={`Selected tests (${items.length})`} />
            <TableShell empty={!items.length ? <EmptyState icon="flask" title="No tests added" description="Pick tests from the catalogue." /> : null}>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Price</th>
                  <th>Discount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.test_id}>
                    <td>
                      <div className="fw-550">{item.name}</div>
                      <div className="text-xs text-subtle">{item.code}</div>
                    </td>
                    <td><Input type="number" min="0" step="0.01" value={item.price} onChange={(e) => updateItem(item.test_id, { price: Number(e.target.value) })} /></td>
                    <td><Input type="number" min="0" step="0.01" value={item.discount} onChange={(e) => updateItem(item.test_id, { discount: Number(e.target.value) })} /></td>
                    <td><Button variant="ghost" size="xs" icon="x" onClick={() => removeItem(item.test_id)} /></td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <CardBody>
              <div className="receipt-totals">
                <div className="receipt-total-row"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
                <div className="receipt-total-row"><span>Item discounts</span><span>-{formatMoney(itemDiscount, currency)}</span></div>
                <div className="receipt-total-row"><span>Order discount</span><span>-{formatMoney(discount, currency)}</span></div>
                <div className="receipt-total-row"><span>Tax</span><span>{formatMoney(taxAmount, currency)}</span></div>
                <div className="receipt-total-row grand"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
              </div>
              <div className="form-grid mt-4">
                <Field label="Collect now">
                  <Input type="number" min="0" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0.00" />
                </Field>
                <Field label="Method">
                  <Select value={payMethod} options={PAYMENT_METHOD_OPTIONS} onChange={(e) => setPayMethod(e.target.value)} />
                </Field>
                <Field label="Reference" className="span-full">
                  <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} />
                </Field>
              </div>
              <div className="mt-4">
                <Button type="submit" variant="primary" loading={saving} icon="check">Create order</Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </form>
    </div>
  );
}
