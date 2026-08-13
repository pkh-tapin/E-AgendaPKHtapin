import React, { useState, useEffect } from 'react';
import { db, ref, push, update, remove, onValue, set } from '../firebase';
import { useToast } from '../context/ToastContext';
import { exportAgendaToPDF } from '../utils/pdfExporter';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faCalendarPlus, 
  faMapMarkerAlt, 
  faClock, 
  faUserShield, 
  faEdit, 
  faTrash, 
  faCheckCircle, 
  faFilePdf, 
  faLock,
  faUser,
  faTags,
  faTimes,
  faSave,
  faFilter,
  faSearch
} from '@fortawesome/free-solid-svg-icons';

// DAFTAR NAMA DUMMY LEGACY UNTUK DISARING TOTAL
const DUMMY_SAMPLE_NAMES = ['ahmad', 'budi', 'siti', 'dewi', 'eko', 'fajar', 'gita', 'hadi'];

// HELPER PARSING ARRAY DESA SDM
const parseDesaArray = (rawDesa) => {
  if (!rawDesa) return [];
  let list = [];
  if (Array.isArray(rawDesa)) list = rawDesa.map(String);
  else if (typeof rawDesa === 'object' && rawDesa !== null) list = Object.values(rawDesa).map(String);
  else if (typeof rawDesa === 'string' && rawDesa.trim() && rawDesa !== '-') {
    list = rawDesa.split(',').map((d) => d.trim());
  }
  return list.map(d => d.replace(/^Desa\s*/i, '').trim()).filter(d => d && d !== '-');
};

export default function AgendaView({ agendas = [], categories = [], onAddCategory, isAdmin, staffList = [] }) {
  const { showToast } = useToast();

  // ---------------------------------------------------------------------------
  // 1. STATE SMART FILTER & MASTER WILAYAH DINAMIK DARI DATABASE
  // ---------------------------------------------------------------------------
  const [filterSearch, setFilterSearch] = useState('');
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMode, setFilterMode] = useState('all');

  // Master Wilayah Dinamis dari Firebase Database (config/wilayah)
  const [wilayahData, setWilayahData] = useState({});

  // Fetch Master Wilayah dari Realtime Database
  useEffect(() => {
    const wilayahRef = ref(db, 'config/wilayah');
    const unsubscribe = onValue(wilayahRef, (snapshot) => {
      const data = snapshot.val();
      setWilayahData(data || {});
    });
    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------------------------
  // 2. STATE SDM LOKAL (SINKRON DENGAN DATABASE /staff REALTIME 100%)
  // ---------------------------------------------------------------------------
  const [localStaffList, setLocalStaffList] = useState([]);

  useEffect(() => {
    const staffRef = ref(db, 'staff');
    const unsubscribe = onValue(staffRef, (snapshot) => {
      const data = snapshot.val();
      if (data && typeof data === 'object') {
        const list = Object.entries(data).map(([id, val]) => {
          if (typeof val === 'string') return { id, name: val, isDummyString: true };
          return { id, ...val, name: val.name || val.nama || val.NAMA || id };
        });

        // Menyaring data dummy/sample legacy agar murni sesuai Database SDM aktif
        const cleaned = list.filter((s) => {
          if (!s || !s.name || typeof s.name !== 'string' || s.name.trim() === '') return false;
          if (s.isDummyString) return false;

          const lowerName = s.name.toLowerCase().trim();
          const isSampleName = DUMMY_SAMPLE_NAMES.includes(lowerName);
          const isLegacyId = !s.id || s.id.length < 5 || /^s\d+$/i.test(s.id);
          const hasNoDetails = (!s.nik || s.nik === '-') && (!s.phone || s.phone === '-');

          if (isSampleName && (isLegacyId || hasNoDetails)) {
            return false;
          }
          return true;
        });

        setLocalStaffList(cleaned);
      } else {
        setLocalStaffList([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------------------------
  // 3. STATE KATEGORI KEGIATAN (REALTIME FIREBASE & MODAL KELOLA SINKRON)
  // ---------------------------------------------------------------------------
  const [localCategories, setLocalCategories] = useState([]);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [editingCatObj, setEditingCatObj] = useState(null);
  const [editCatInput, setEditCatInput] = useState('');

  // Fetch Kategori dari Realtime Database
  useEffect(() => {
    const catRef = ref(db, 'categories');
    const unsubscribe = onValue(catRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        if (Array.isArray(data)) {
          setLocalCategories(data.map((c, i) => (typeof c === 'object' ? { id: i, name: c.name || c } : { id: i, name: String(c) })));
        } else if (typeof data === 'object') {
          const list = Object.entries(data).map(([id, val]) => {
            if (typeof val === 'object' && val !== null) {
              return { id, name: val.name || val.title || id };
            }
            return { id, name: String(val) };
          });
          setLocalCategories(list);
        }
      } else if (categories && categories.length > 0) {
        setLocalCategories(categories.map((c, i) => ({ id: `prop-${i}`, name: String(c) })));
      } else {
        setLocalCategories([
          { id: 'def-1', name: 'Rapat' },
          { id: 'def-2', name: 'Pendampingan' },
          { id: 'def-3', name: 'Penyaluran Bansos' },
          { id: 'def-4', name: 'Bimtek / Pelatihan' }
        ]);
      }
    });

    return () => unsubscribe();
  }, [categories]);

  // Handler Tambah Kategori Baru (Penyimpanan Aman Tanpa False Error Toast)
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    const catName = newCatInput.trim();
    if (!catName) return showToast('Nama kategori tidak boleh kosong!', 'error');

    try {
      await push(ref(db, 'categories'), { name: catName });
      
      try {
        if (onAddCategory) onAddCategory(catName);
      } catch (pErr) {
        console.warn("Parent callback error:", pErr);
      }

      showToast(`Kategori "${catName}" berhasil ditambahkan!`, 'success');
      setNewCatInput('');
    } catch (err) {
      console.error("Gagal tambah kategori:", err);
      showToast('Gagal menambahkan kategori.', 'error');
    }
  };

  // Handler Update / Edit Kategori
  const handleUpdateCategory = async (catItem) => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    const updatedName = editCatInput.trim();
    if (!updatedName) return showToast('Nama kategori tidak boleh kosong!', 'error');

    try {
      if (String(catItem.id).startsWith('def-') || String(catItem.id).startsWith('prop-')) {
        await push(ref(db, 'categories'), { name: updatedName });
      } else {
        await set(ref(db, `categories/${catItem.id}`), { name: updatedName });
      }

      showToast(`Kategori diperbarui menjadi "${updatedName}"!`, 'success');
      setEditingCatObj(null);
      setEditCatInput('');
    } catch (err) {
      console.error("Gagal update kategori:", err);
      showToast('Gagal memperbarui kategori.', 'error');
    }
  };

  // Handler Hapus Kategori
  const handleDeleteCategory = async (catItem) => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (window.confirm(`Hapus kategori "${catItem.name}"?`)) {
      try {
        if (!String(catItem.id).startsWith('def-') && !String(catItem.id).startsWith('prop-')) {
          await remove(ref(db, `categories/${catItem.id}`));
        }
        showToast(`Kategori "${catItem.name}" berhasil dihapus!`, 'info');
      } catch (err) {
        console.error("Gagal hapus kategori:", err);
        showToast('Gagal menghapus kategori.', 'error');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 4. STATE FORM & HANDLERS AGENDA (KECAMATAN TERKUNCI BERDASARKAN DATABASE SDM)
  // ---------------------------------------------------------------------------
  const allKecamatanKeys = Object.keys(wilayahData);

  const [formData, setFormData] = useState({
    title: '',
    sdmName: '',
    date: '',
    time: '',
    kecamatan: '',
    desa: '',
    category: 'Rapat'
  });

  const [editingId, setEditingId] = useState(null);

  // Handler Pemilihan SDM -> Otomatis Mengunci Kecamatan Sesuai Database SDM
  const handleSdmSelectChange = (selectedSdmName) => {
    if (!selectedSdmName) {
      setFormData((prev) => ({
        ...prev,
        sdmName: '',
        kecamatan: '',
        desa: ''
      }));
      return;
    }

    const foundStaff = localStaffList.find(
      (s) => (s.name || s.NAMA || s.nama) === selectedSdmName
    );

    let staffKec = foundStaff?.kecamatan && foundFoundKec(foundStaff) ? foundStaff.kecamatan : (foundStaff?.['KECAMATAN (SK)'] || foundStaff?.['KECAMATAN (DOM)'] || '');
    if ((!staffKec || staffKec === '-') && allKecamatanKeys.length > 0) {
      staffKec = allKecamatanKeys[0];
    }

    const staffDesaArr = parseDesaArray(foundStaff?.desa);
    const masterDesaArr = wilayahData[staffKec] || [];
    const combinedDesa = Array.from(new Set([...staffDesaArr, ...masterDesaArr])).filter(Boolean);

    setFormData((prev) => ({
      ...prev,
      sdmName: selectedSdmName,
      kecamatan: staffKec,
      desa: combinedDesa[0] || ''
    }));
  };

  const foundFoundKec = (s) => s?.kecamatan && s.kecamatan !== '-';

  // Mengambil daftar Desa yang valid berdasarkan Kecamatan SDM Terkunci
  const currentStaffObj = localStaffList.find((s) => (s.name || s.NAMA || s.nama) === formData.sdmName);
  const staffDesaArr = parseDesaArray(currentStaffObj?.desa);
  const masterDesaArr = wilayahData[formData.kecamatan] || [];
  const availableDesaForForm = Array.from(new Set([...staffDesaArr, ...masterDesaArr])).filter(Boolean);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title || !formData.sdmName || !formData.date || !formData.time || !formData.desa) {
      return showToast('Harap isi semua kolom agenda termasuk Nama SDM dan Lokasi Desa!', 'error');
    }

    if (editingId) {
      update(ref(db, `agendas/${editingId}`), formData);
      showToast('Agenda berhasil diperbarui!', 'success');
    } else {
      push(ref(db, 'agendas'), {
        ...formData,
        isSupervisiKatim: false
      });
      showToast('Agenda kerja baru berhasil dibuat!', 'success');
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      title: '',
      sdmName: '',
      date: '',
      time: '',
      kecamatan: '',
      desa: '',
      category: localCategories[0]?.name || 'Rapat'
    });
    setEditingId(null);
  };

  const handleEditClick = (ag) => {
    setEditingId(ag.id);
    const agKec = ag.kecamatan || '';
    setFormData({
      title: ag.title || '',
      sdmName: ag.sdmName || '',
      date: ag.date || '',
      time: ag.time || '',
      kecamatan: agKec,
      desa: ag.desa || '',
      category: ag.category || localCategories[0]?.name || 'Rapat'
    });
  };

  const handleDeleteAgenda = (id, title) => {
    if (window.confirm(`Hapus agenda "${title}"?`)) {
      remove(ref(db, `agendas/${id}`));
      showToast('Agenda berhasil dihapus!', 'info');
    }
  };

  // Toggle Supervisi Ketua Tim (Admin)
  const handleToggleSupervisi = (ag) => {
    if (!isAdmin) {
      return showToast('Hanya Ketua Tim (Admin) yang berhak menentukan Supervisi!', 'error');
    }
    const updatedStatus = !ag.isSupervisiKatim;
    update(ref(db, `agendas/${ag.id}`), { isSupervisiKatim: updatedStatus });
    showToast(
      updatedStatus
        ? 'Agenda disetujui untuk Supervisi Ketua Tim!'
        : 'Status Supervisi Ketua Tim dibatalkan.',
      'info'
    );
  };

  // ---------------------------------------------------------------------------
  // LOGIKA SMART FILTER AGENDA
  // ---------------------------------------------------------------------------
  const displayedAgendas = agendas.filter((ag) => {
    const matchSearch =
      (ag.title || '').toLowerCase().includes(filterSearch.toLowerCase()) ||
      (ag.sdmName || '').toLowerCase().includes(filterSearch.toLowerCase());

    const matchKec = !filterKecamatan || ag.kecamatan === filterKecamatan;
    const matchDesa = !filterDesa || ag.desa === filterDesa;
    const matchCat = !filterCategory || ag.category === filterCategory;
    const matchSupervisi = filterMode !== 'supervisi' || ag.isSupervisiKatim === true;

    return matchSearch && matchKec && matchDesa && matchCat && matchSupervisi;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full">
      {/* FORM TAMBAH / EDIT AGENDA - MOBILE FIRST MODERN */}
      <div className="p-4 sm:p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass">
        <h3 className="text-base sm:text-xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2.5">
          <FontAwesomeIcon icon={faCalendarPlus} className="text-indigo-400 text-lg sm:text-xl" />
          <span>{editingId ? 'Edit Agenda Kerja' : 'Buat Agenda Kerja SDM'}</span>
        </h3>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
          {/* Nama Kegiatan */}
          <div className="lg:col-span-2">
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">Nama Kegiatan / Agenda</label>
            <input
              type="text"
              placeholder="Contoh: Pendampingan KPM PKH Desa Rantau"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Nama SDM Pelaksana (Disinkronkan Murni dengan Database SDM) */}
          <div>
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">
              Nama SDM / Petugas ({localStaffList.length} Orang Terdaftar)
            </label>
            <select
              value={formData.sdmName}
              onChange={(e) => handleSdmSelectChange(e.target.value)}
              className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:border-indigo-500 outline-none cursor-pointer font-semibold transition-colors"
            >
              <option value="" className="bg-slate-900 text-slate-400">-- Pilih SDM dari Database --</option>
              {localStaffList && localStaffList.length > 0 ? (
                localStaffList.map((s, idx) => {
                  const sName = typeof s === 'object' && s !== null ? (s.name || s.NAMA || s.nama || s.id) : String(s);
                  const sKey = typeof s === 'object' && s !== null ? (s.id || s.name || idx) : idx;
                  return (
                    <option key={sKey} value={sName} className="bg-slate-900 text-white">
                      {sName}
                    </option>
                  );
                })
              ) : (
                <option value="" disabled className="bg-slate-900 text-slate-500">Memuat Data SDM...</option>
              )}
            </select>
          </div>

          {/* Tanggal Kegiatan */}
          <div>
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">Tanggal Kegiatan</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Jam Kegiatan */}
          <div>
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">Jam Kegiatan</label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          {/* Kategori Kegiatan */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block">Kategori Kegiatan</label>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setCatModalOpen(true)}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold underline cursor-pointer flex items-center gap-1"
                >
                  <FontAwesomeIcon icon={faTags} />
                  <span>Kelola Kategori</span>
                </button>
              )}
            </div>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:border-indigo-500 outline-none cursor-pointer transition-colors"
            >
              {localCategories.map((cat) => (
                <option key={cat.id || cat.name} value={cat.name} className="bg-slate-900">
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Kecamatan (KUNCI OTOMATIS BERDASARKAN DATABASE SDM TERPILIH) */}
          <div>
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">
              Kecamatan (Terkunci Sesuai SDM)
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                disabled
                value={formData.kecamatan ? `Kec. ${formData.kecamatan}` : '-- Pilih SDM Dahulu --'}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/40 border border-indigo-500/30 text-indigo-300 font-bold text-xs sm:text-sm outline-none cursor-not-allowed"
              />
              <FontAwesomeIcon icon={faLock} className="absolute right-3.5 top-3.5 sm:top-4 text-indigo-400/60 text-xs" />
            </div>
          </div>

          {/* Desa / Kelurahan (HANYA MEMILIH DESA DARI KECAMATAN SDM) */}
          <div>
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">
              Desa / Kelurahan ({availableDesaForForm.length} Desa Tersedia)
            </label>
            <select
              value={formData.desa}
              onChange={(e) => setFormData({ ...formData, desa: e.target.value })}
              disabled={!formData.sdmName}
              className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm focus:border-indigo-500 outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {availableDesaForForm.length > 0 ? (
                availableDesaForForm.map((des) => (
                  <option key={des} value={des} className="bg-slate-900 text-white">
                    Desa {des}
                  </option>
                ))
              ) : (
                <option value="">-- Pilih SDM Dahulu --</option>
              )}
            </select>
          </div>

          {/* Tombol Simpan & Batal */}
          <div className="flex items-end gap-2 lg:col-span-1 pt-1 sm:pt-0">
            <button
              type="submit"
              className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm shadow-3d-button transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <FontAwesomeIcon icon={editingId ? faCheckCircle : faPlus} />
              <span>{editingId ? 'Update Agenda' : 'Simpan Agenda'}</span>
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-3 rounded-2xl bg-slate-800 text-slate-300 font-bold text-xs sm:text-sm hover:bg-slate-700 transition-all cursor-pointer active:scale-95"
              >
                Batal
              </button>
            )}
          </div>
        </form>
      </div>

      {/* SMART FILTER BAR LOKASI (100% DINAMIS DARI DATABASE WILAYAH) */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-indigo-500/30 backdrop-blur-xl space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs sm:text-sm">
          <FontAwesomeIcon icon={faFilter} />
          <span>Smart Filter Agenda (Master Wilayah Database)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-slate-500 text-xs" />
            <input
              type="text"
              placeholder="Cari Kegiatan / SDM..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
            />
          </div>

          <select
            value={filterKecamatan}
            onChange={(e) => {
              setFilterKecamatan(e.target.value);
              setFilterDesa('');
            }}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Semua Kecamatan --</option>
            {allKecamatanKeys.map((kec) => (
              <option key={kec} value={kec}>Kec. {kec}</option>
            ))}
          </select>

          <select
            value={filterDesa}
            onChange={(e) => setFilterDesa(e.target.value)}
            disabled={!filterKecamatan}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            <option value="">-- Semua Desa/Kel. --</option>
            {filterKecamatan && (wilayahData[filterKecamatan] || []).map((des) => (
              <option key={des} value={des}>Desa {des}</option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Semua Kategori --</option>
            {localCategories.map((c) => (
              <option key={c.id || c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* HEADER LIST & DOWNLOAD AGENDA */}
      <div className="space-y-4">
        <div className="flex justify-between items-center flex-wrap gap-3 sm:gap-4">
          <h3 className="text-base sm:text-xl font-bold text-white">
            Daftar Agenda Terjadwal ({displayedAgendas.length} Data)
          </h3>

          <div className="flex gap-2 sm:gap-3 items-center flex-wrap w-full sm:w-auto">
            <button
              onClick={() => exportAgendaToPDF(displayedAgendas)}
              className="flex-1 sm:flex-none px-3.5 py-2.5 sm:py-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-3d-button flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <FontAwesomeIcon icon={faFilePdf} />
              <span>Download PDF Agenda</span>
            </button>

            <div className="flex gap-1.5 bg-slate-950/80 p-1 rounded-2xl border border-white/10 flex-1 sm:flex-none justify-center">
              <button
                onClick={() => setFilterMode('all')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  filterMode === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Semua
              </button>
              <button
                onClick={() => setFilterMode('supervisi')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  filterMode === 'supervisi' ? 'bg-amber-600 text-white' : 'text-amber-400 hover:text-amber-300'
                }`}
              >
                <FontAwesomeIcon icon={faUserShield} />
                <span>Supervisi Katim</span>
              </button>
            </div>
          </div>
        </div>

        {/* CARD AGENDA GRID - MOBILE FIRST 3D GLASS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {displayedAgendas.length > 0 ? (
            displayedAgendas.map((ag) => (
              <div
                key={ag.id}
                className={`p-4 sm:p-6 rounded-3xl border backdrop-blur-xl shadow-3d-glass flex flex-col justify-between transition-all duration-300 active:scale-[0.99] ${
                  ag.isSupervisiKatim
                    ? 'bg-amber-950/20 border-amber-500/40 shadow-[0_10px_25px_rgba(245,158,11,0.15)]'
                    : 'bg-slate-900/60 border-white/10 hover:border-indigo-500/40'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start mb-2.5 sm:mb-3 gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-bold border border-indigo-400/30 truncate">
                      {ag.category}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                      <FontAwesomeIcon icon={faClock} /> {ag.time} | {ag.date}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm sm:text-lg text-white mb-2 leading-snug break-words">{ag.title}</h4>

                  <p className="text-xs text-emerald-300 font-semibold flex items-center gap-1.5 mb-1.5 break-words">
                    <FontAwesomeIcon icon={faUser} className="text-emerald-400 shrink-0" />
                    <span className="truncate">SDM: {ag.sdmName || 'Belum Ditentukan'}</span>
                  </p>

                  <p className="text-xs text-slate-300 flex items-center gap-1.5 mb-3 break-words">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-rose-400 shrink-0" />
                    <span>Desa {ag.desa}, Kec. {ag.kecamatan}</span>
                  </p>

                  {ag.isSupervisiKatim && (
                    <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                      <FontAwesomeIcon icon={faUserShield} />
                      <span>Disupervisi Ketua Tim</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-1">
                  <button
                    onClick={() => handleToggleSupervisi(ag)}
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-xl border transition-all flex items-center gap-1 cursor-pointer active:scale-95 ${
                      ag.isSupervisiKatim
                        ? 'bg-amber-500/20 border-amber-400/30 text-amber-300'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                    title={isAdmin ? 'Klik untuk mengubah status supervisi' : 'Khusus Ketua Tim'}
                  >
                    <FontAwesomeIcon icon={isAdmin ? faUserShield : faLock} />
                    <span>{ag.isSupervisiKatim ? 'Disupervisi' : 'Pilih Supervisi'}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditClick(ag)} className="p-2 text-indigo-400 hover:text-indigo-300 cursor-pointer" title="Edit Agenda">
                      <FontAwesomeIcon icon={faEdit} />
                    </button>
                    <button onClick={() => handleDeleteAgenda(ag.id, ag.title)} className="p-2 text-rose-400 hover:text-rose-300 cursor-pointer" title="Hapus Agenda">
                      <FontAwesomeIcon icon={faTrash} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-10 sm:py-12 text-slate-400 italic text-xs sm:text-sm border border-dashed border-white/10 rounded-3xl">
              Tidak ada agenda kerja ditemukan berdasarkan filter wilayah/kategori.
            </div>
          )}
        </div>
      </div>

      {/* MODAL KELOLA KATEGORI KEGIATAN */}
      {isAdmin && catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl relative space-y-4 sm:space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => { setCatModalOpen(false); setEditingCatObj(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faTags} className="text-indigo-400" />
              <span>Kelola Kategori Kegiatan</span>
            </h3>

            <form onSubmit={handleAddCategory} className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">Tambah Kategori Baru</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Nama Kategori Baru"
                  value={newCatInput}
                  onChange={(e) => setNewCatInput(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Tambah</span>
                </button>
              </div>
            </form>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-semibold text-slate-400 block">Daftar Kategori Terdaftar</label>
              <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                {localCategories.map((cat) => (
                  <div key={cat.id || cat.name} className="p-2.5 sm:p-3 rounded-xl bg-slate-950 border border-white/10 flex justify-between items-center text-xs">
                    {editingCatObj?.id === cat.id ? (
                      <div className="flex items-center gap-2 w-full">
                        <input
                          type="text"
                          value={editCatInput}
                          onChange={(e) => setEditCatInput(e.target.value)}
                          className="flex-1 px-2.5 py-1 rounded-lg bg-slate-900 border border-indigo-400 text-white text-xs outline-none"
                        />
                        <button
                          onClick={() => handleUpdateCategory(cat)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer"
                        >
                          <FontAwesomeIcon icon={faSave} />
                        </button>
                        <button
                          onClick={() => setEditingCatObj(null)}
                          className="px-2 py-1 text-slate-400 hover:text-white text-[10px] cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-white truncate mr-2">{cat.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditingCatObj(cat); setEditCatInput(cat.name); }}
                            className="text-indigo-400 hover:text-indigo-300 p-1 cursor-pointer"
                            title="Edit Kategori"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                            title="Hapus Kategori"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => { setCatModalOpen(false); setEditingCatObj(null); }}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer active:scale-95"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}