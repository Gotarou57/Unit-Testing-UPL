import { act } from '@testing-library/react';

describe('Unit Testing - handleStatusCycle', () => {
  // 1. Siapkan variabel tiruan untuk menampung State
  let mockReport;
  let mockStatusMap;
  let mockSetModal;
  let mockSetReport;
  let mockSetAllReports;
  let id;
  let API_URL;

  beforeEach(() => {
    // Reset data dan fungsi tiruan setiap kali tes baru dimulai
    id = '123';
    API_URL = 'http://localhost:5000';
    
    mockReport = { id: '123', status: 'TODO_DB_STATUS' };
    mockStatusMap = { 'TODO_DB_STATUS': 'To-Do' }; // Memetakan status ke 'To-Do'
    
    mockSetModal = jest.fn();
    mockSetReport = jest.fn();
    mockSetAllReports = jest.fn();

    // Mock global window.location dan alert agar tidak crash saat dijalankan di terminal
    delete window.location;
    window.location = { href: jest.fn() };
    global.alert = jest.fn();

    // Mock LocalStorage
    const localStorageMock = (() => {
      let store = { token: 'fake-jwt-token' };
      return {
        getItem: (key) => store[key] || null,
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    // Mock global fetch API
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // --- FUNGSI SUNTIKAN (Sama persis dengan logika kodemu untuk ditest) ---
  const runHandleStatusCycle = () => {
    if (!mockReport) return;
    const currentMapped = mockStatusMap[mockReport.status];
    const statusFlow = {
      'To-Do': { next: 'Processed', db: 'In Progress', msg: 'Mulai proses pengerjaan?' },
      'Processed': { next: 'Done', db: 'Done', msg: 'Tandai laporan sebagai selesai?' },
      'Done': { next: 'To-Do', db: 'To-Do', msg: 'Reset status ke To-Do?' }
    };
    const flow = statusFlow[currentMapped];
    
    mockSetModal({
      isOpen: true,
      title: 'Konfirmasi',
      message: flow.msg,
      action: async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            alert('Sesi berakhir, silakan login ulang.');
            window.location.href = '/login';
            return;
          }
          const res = await fetch(`/api/reports/${id}/status`, {
            method: 'PUT',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: flow.db })
          });
          
          if (res.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
            return;
          }
          
          if (!res.ok) {
            alert(`Gagal mengubah status`);
            return;
          }

          mockSetReport({ ...mockReport, status: flow.db });

          const reportsRes = await fetch(`${API_URL}/api/reports`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (reportsRes.ok) {
            const data = await reportsRes.json();
            if (Array.isArray(data)) {
              mockSetAllReports(data);
            }
          }
        } catch (e) {
          alert('Terjadi kesalahan');
        }
        mockSetModal({ isOpen: false, title: '', message: '', action: null });
      }
    });
  };

  // ==================== SKENARIO UJI ====================

  test('Skenario 1: Harus membuka modal konfirmasi dengan pesan yang benar (Status To-Do)', () => {
    runHandleStatusCycle();

    
    expect(mockSetModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        message: 'Mulai proses pengerjaan?'
      })
    );
  });

  test('Skenario 2: Berhasil mengubah status laporan melalui API (Alur Sukses)', async () => {
    
    global.fetch
      .mockResolvedValueOnce({ status: 200, ok: true }) // Respon PUT
      .mockResolvedValueOnce({                          // Respon GET Refresh
        ok: true,
        json: async () => [{ id: '123', status: 'In Progress' }]
      });

    
    runHandleStatusCycle();

    
    const modalConfig = mockSetModal.mock.calls[0][0];
    const confirmAction = modalConfig.action;

    
    await act(async () => {
      await confirmAction();
    });

    
    expect(global.fetch).getMockImplementation();
    expect(global.fetch).toHaveBeenCalledWith(`/api/reports/123/status`, expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ status: 'In Progress' })
    }));

    
    expect(mockSetReport).toHaveBeenCalledWith({ id: '123', status: 'In Progress' });
    
    
    expect(mockSetAllReports).toHaveBeenCalled();
  });

  test('Skenario 3: Harus mengarahkan ke halaman login jika token tidak ada', async () => {
    
    window.localStorage.removeItem('token');

    runHandleStatusCycle();
    const modalConfig = mockSetModal.mock.calls[0][0];
    
    await act(async () => {
      await modalConfig.action();
    });

    
    expect(global.alert).toHaveBeenCalledWith('Sesi berakhir, silakan login ulang.');
    
    expect(window.location.href).toBe('/login');
  });
});