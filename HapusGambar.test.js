import { act } from '@testing-library/react';

describe('Unit Testing - handleDeleteImage', () => {
  let mockSetModal;
  let mockNavigate;
  let mockSetReport;
  let mockSetError;
  let id;

  beforeEach(() => {
    id = 'rep-789';
    
    
    mockSetModal = jest.fn();
    mockNavigate = jest.fn();
    mockSetReport = jest.fn();
    mockSetError = jest.fn();

    
    const localStorageMock = (() => {
      let store = { token: 'valid-token-teknisi' };
      return {
        getItem: (key) => store[key] || null,
        clear: () => { store = {}; }
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  
  const runHandleDeleteImage = async (slot) => {
    mockSetModal({
      isOpen: true,
      title: 'Hapus Gambar',
      message: `Yakin ingin menghapus gambar slot ${slot}?`,
      action: async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            mockNavigate('/login');
            return;
          }

          const res = await fetch(`/api/teknisi/reports/${id}/images/${slot}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (res.status === 401) {
            localStorage.clear();
            mockNavigate('/login');
            return;
          }

          if (!res.ok) {
            const t = await res.text();
            mockSetError(`Gagal menghapus gambar: ${t}`);
            return;
          }

          const data = await res.json();
          const [u1, u2, u3] = data.urls;

          mockSetReport(prev => ({
            ...prev,
            image_url: u1 || null,
            image_url2: u2 || null,
            image_url3: u3 || null
          }));

          mockSetModal({ isOpen: false });
        } catch (err) {
          mockSetError(`Terjadi kesalahan: ${err.message}`);
        }
      }
    });
  };

  // ==================== SKENARIO UJI ====================

  test('Skenario 1: Harus membuka modal konfirmasi hapus gambar dengan teks slot yang sesuai', async () => {
    
    await runHandleDeleteImage(2);

    expect(mockSetModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        title: 'Hapus Gambar',
        message: 'Yakin ingin menghapus gambar slot 2?'
      })
    );
  });

  test('Skenario 2: Berhasil menghapus gambar melalui API DELETE (Alur Sukses)', async () => {
    
    global.fetch.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({
        urls: ['http://img1.com', '', 'http://img3.com'] // slot 2 dikosongkan backend
      })
    });

    await runHandleDeleteImage(2);

    
    const modalConfig = mockSetModal.mock.calls[0][0];
    const confirmAction = modalConfig.action;

    await act(async () => {
      await confirmAction();
    });

    
    expect(global.fetch).toHaveBeenCalledWith(`/api/teknisi/reports/rep-789/images/2`, expect.objectContaining({
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer valid-token-teknisi' }
    }));

    
    expect(mockSetReport).toHaveBeenCalled();
    const updaterFunction = mockSetReport.mock.calls[0][0];
    const mockPrevState = { image_url: 'a', image_url2: 'b', image_url3: 'c' };
    
    expect(updaterFunction(mockPrevState)).toEqual({
      image_url: 'http://img1.com',
      image_url2: null, // Berubah jadi null karena string kosong ''
      image_url3: 'http://img3.com'
    });

    
    expect(mockSetModal).toHaveBeenCalledWith({ isOpen: false });
  });

  test('Skenario 3: Harus clear storage dan redirect ke /login jika API merespon 401 (Unauthorized)', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 401,
      ok: false
    });

    
    const spyClear = jest.spyOn(window.localStorage, 'clear');

    await runHandleDeleteImage(1);
    const modalConfig = mockSetModal.mock.calls[0][0];

    await act(async () => {
      await modalConfig.action();
    });

    
    expect(spyClear).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
    
    spyClear.mockRestore();
  });

  test('Skenario 4: Harus memunculkan setError jika API gagal (cth: 500 Server Error)', async () => {
    global.fetch.mockResolvedValueOnce({
      status: 500,
      ok: false,
      text: async () => 'Koneksi database terputus'
    });

    await runHandleDeleteImage(3);
    const modalConfig = mockSetModal.mock.calls[0][0];

    await act(async () => {
      await modalConfig.action();
    });

    
    expect(mockSetError).toHaveBeenCalledWith('Gagal menghapus gambar: Koneksi database terputus');
  });
});