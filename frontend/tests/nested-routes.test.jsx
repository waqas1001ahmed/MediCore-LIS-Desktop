import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { api } from '../src/api/client.js';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { SettingsProvider } from '../src/context/SettingsContext.jsx';
import PatientDetail from '../src/pages/patients/PatientDetail.jsx';

const WrappedPatientDetail = ({ initialEntry }) => (
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route
        path="patients/:id"
        element={
          <AuthProvider>
            <SettingsProvider>
              <PatientDetail />
            </SettingsProvider>
          </AuthProvider>
        }
      />
    </Routes>
  </MemoryRouter>
);

let mock;

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  mock = new MockAdapter(api);
});

afterEach(() => {
  if (mock) mock.restore();
});

const patient = {
  id: 1, full_name: 'Jane Doe', patient_code: 'P-001', gender: 'female',
  age: 30, age_unit: 'years', phone: '555-0100', email: 'jane@example.com',
  blood_group: 'O+', national_id: 'ID-1', address: '123 Main St', doctor_name: 'Dr. Smith',
  notes: '', created_at: '2024-01-01', stats: {},
};

const history = {
  patient: { id: 1 },
  stats: {},
  orders: [], tests: [], reports: [], payments: [],
};

describe('Direct nested-route rendering (PatientDetail at /patients/:id)', () => {
  test('renders patient detail when API returns matching patient', async () => {
    mock.onGet('/patients/1/history').reply(200, { data: history });
    mock.onGet('/patients/1').reply(200, { data: patient });
    mock.onGet('/settings/branding').reply(200, { data: {} });

    render(<WrappedPatientDetail initialEntry="/patients/1" />);

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeTruthy());
  });

  test('renders loading state while fetching patient data', async () => {
    mock.onGet('/patients/1/history').reply(200, { data: history });
    mock.onGet('/patients/1').reply(200, { data: patient });
    mock.onGet('/settings/branding').reply(200, { data: {} });

    render(<WrappedPatientDetail initialEntry="/patients/1" />);

    expect(screen.getByText(/Loading patient/)).toBeTruthy();

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Jane Doe' })).toBeTruthy());
  });
});

