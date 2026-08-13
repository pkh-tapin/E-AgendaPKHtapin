import React, { useState, useEffect } from 'react';
import { db, ref, push, set, remove, update, onValue } from '../firebase';
import { useToast } from '../context/ToastContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHeadset, 
  faPlus, 
  faSearch, 
  faFilter, 
  faMapMarkerAlt, 
  faUser, 
  faPhone, 
  faCalendarAlt, 
  faTag, 
  faCheckCircle, 
  faClock, 
  faExclamationCircle, 
  faTrashAlt, 
  faEdit, 
  faEye, 
  faTimes, 
  faSave, 
  faFilePdf, 
  faTasks,
  faBuilding,
  faLayerGroup
} from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// DATA SMART FILTER WILAYAH KABUPATEN TAPIN (12 KECAMATAN LENGKAP)
const TAPIN_WILAYAH = {
  "Binuang": ["Binuang", "Raya Belanti", "A Yani Pura", "Karang Putih", "Pualam Sari", "Tungkap", "Padang Sari", "Gunung Tinggi"],
  "Tapin Utara": ["Rangda Malingkung", "Kupang", "Rantau Kanan", "Rantau Kiwa", "Jingah Habang", "Keraton", "Perintis Raya", "Banua Halat Kiri", "Banua Halat Kanan", "Badaun", "Antasari", "Banua Hanyar"],
  "Tapin Tengah": ["Pandahan", "Pandulangan", "Tirik", "Labung", "Mandurian", "Mandurian Hilir", "Ni'ah", "Sukaramai", "Kepayang", "Batang Lantik", "Hiyung", "Pabaungan Hilir", "Pabaungan Hulu", "Pabaungan Pantai"],
  "Tapin Selatan": ["Tambarangan", "Lawahan", "Suato Tatakan", "Tatakan", "Harapan Masa", "Rumintin", "Sawang", "Timbaa", "Candi Laras"],
  "Candi Laras Utara": ["Margasari Hilir", "Bawa Kapor", "Buas-Buas", "Keladan", "Pariok", "Kalumpang", "Sawaja", "Teluk Haur", "Batalas"],
  "Candi Laras Selatan": ["Margasari Hulu", "Baulin", "Paring Guling", "Baringin A", "Baringin B", "Candi Laras", "Sungai Rutas", "Sungai Rutas Hulu"],
  "Lokpaikat": ["Lokpaikat", "Bitahan", "Bitahan Baru", "Ayuning", "Bajuin", "Binderang", "Parandakan", "Puncak Harapan"],
  "Salam Babaris": ["Salam Babaris", "Kembang Habang", "Suato Baru", "Pantai Cabe", "Kambang Habang Baru"],
  "Bakarangan": ["Bakarangan", "Bundung", "Tangkawang", "Paul", "Gadung", "Tangkawang Baru", "Waringin"],
  "Piani": ["Miawa", "Batu Ampar", "Pipitak Jaya", "Harakit", "Balawaian"],
  "Bungur": ["Bungur", "Bungur Baru", "Purrut", "Banua Hanyar", "Rantau Nangka", "Sabah", "Timbung", "Linuh", "Parkit"],
  "Hatungun": ["Hatungun", "Asam Randah", "Matang Ranum", "Burakai", "Bagus", "Pandulangan", "Tarungin", "Kambet"]
};

export default function Pengaduan({ staffList = [], isAdmin = false }) {
  const { showToast } = useToast();

  // -------------------------------------------------------------
  // STATE REALTIME DATA FIREBASE
  // -------------------------------------------------------------
  const [complaints, setComplaints] = useState([]);
  const [categories, setCategories] = useState([]);

  // Smart Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKecamatan, setSelectedKecamatan] = useState('');
  const [selectedDesa, setSelectedDesa] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [detailModalData, setDetailModalData] = useState(null);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [form, setForm] = useState({
    namaPengadu: '',
    noTelp: '',
    jenisPengaduan: '',
    kecamatan: 'Tapin Utara',
    desa: 'Rantau Kanan',
    isiPengaduan: '',
    status: 'Baru', // 'Baru' | 'Diproses' | 'Selesai' | 'Ditolak'
    tindakLanjut: '',
    penerimaPengaduan: ''
  });

  const [newCategoryName, setNewCategoryName] = useState('');

  // -------------------------------------------------------------
  // REALTIME LISTENERS FIREBASE
  // -------------------------------------------------------------
  useEffect(() => {
    const complaintRef = ref(db, 'pengaduan');
    const unsubComplaint = onValue(complaintRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setComplaints(list.reverse());
      } else {
        setComplaints([]);
      }
    });

    const categoryRef = ref(db, 'categories_pengaduan');
    const unsubCat = onValue(categoryRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setCategories(list);
      } else {
        // Default categories jika kosong
        setCategories([
          { id: '1', name: 'Bantuan Sosial PKH Tidak Cair' },
          { id: '2', name: 'Permasalahan Kartu KKS / ATM' },
          { id: '3', name: 'Perubahan Data Anggota Keluarga' },
          { id: '4', name: 'Laporan Usul Sanggah / Pungli' },
          { id: '5', name: 'Lainnya' }
        ]);
      }
    });

    return () => {
      unsubComplaint();
      unsubCat();
    };
  }, []);

  const getStaffName = (id) => {
    const found = staffList.find((s) => (typeof s === 'object' ? s.id === id || s.name === id || s.NAMA === id : s === id));
    if (found) return typeof found === 'object' ? found.name || found.NAMA || found.nama || found.id : found;
    return id || '-';
  };

  // -------------------------------------------------------------
  // LOGIKA SMART FILTER
  // -------------------------------------------------------------
  const filteredComplaints = complaints.filter((item) => {
    const matchSearch = 
      (item.namaPengadu || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.noTelp || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.isiPengaduan || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchKec = !selectedKecamatan || item.kecamatan === selectedKecamatan;
    const matchDesa = !selectedDesa || item.desa === selectedDesa;
    const matchCat = !selectedCategory || item.jenisPengaduan === selectedCategory;
    const matchStat = !selectedStatus || item.status === selectedStatus;

    return matchSearch && matchKec && matchDesa && matchCat && matchStat;
  });

  // -------------------------------------------------------------
  // HANDLERS FORM & CRUD
  // -------------------------------------------------------------
  const handleKecamatanFormChange = (kec) => {
    const desas = TAPIN_WILAYAH[kec] || [];
    setForm((prev) => ({
      ...prev,
      kecamatan: kec,
      desa: desas[0] || ''
    }));
  };

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      namaPengadu: '',
      noTelp: '',
      jenisPengaduan: categories[0]?.name || 'Bantuan Sosial PKH Tidak Cair',
      kecamatan: 'Tapin Utara',
      desa: TAPIN_WILAYAH['Tapin Utara'][0],
      isiPengaduan: '',
      status: 'Baru',
      tindakLanjut: '',
      penerimaPengaduan: staffList[0]?.name || staffList[0]?.NAMA || staffList[0]?.id || ''
    });
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (item) => {
    setEditingId(item.id);
    setForm({
      namaPengadu: item.namaPengadu || '',
      noTelp: item.noTelp || '',
      jenisPengaduan: item.jenisPengaduan || categories[0]?.name || '',
      kecamatan: item.kecamatan || 'Tapin Utara',
      desa: item.desa || '',
      isiPengaduan: item.isiPengaduan || '',
      status: item.status || 'Baru',
      tindakLanjut: item.tindakLanjut || '',
      penerimaPengaduan: item.penerimaPengaduan || ''
    });
    setIsAddModalOpen(true);
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!form.namaPengadu || !form.noTelp || !form.isiPengaduan) {
      return showToast?.('Harap lengkapi Nama, No. Telp, dan Isi Pengaduan!', 'error');
    }

    try {
      const payload = {
        ...form,
        updatedAt: Date.now(),
        dateStr: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      };

      if (editingId) {
        await update(ref(db, `pengaduan/${editingId}`), payload);
        showToast?.('Data pengaduan berhasil diperbarui!', 'success');
      } else {
        payload.createdAt = Date.now();
        const newRef = push(ref(db, 'pengaduan'));
        await set(newRef, payload);
        showToast?.('Pengaduan baru berhasil direkam!', 'success');
      }

      setIsAddModalOpen(false);
    } catch (err) {
      showToast?.('Gagal menyimpan pengaduan.', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!isAdmin) return showToast?.('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('Apakah Anda yakin ingin menghapus catatan pengaduan ini?')) {
      try {
        await remove(ref(db, `pengaduan/${id}`));
        showToast?.('Data pengaduan berhasil dihapus!', 'info');
      } catch (err) {
        showToast?.('Gagal menghapus pengaduan.', 'error');
      }
    }
  };

  // Handler Tambah Jenis Pengaduan (Admin)
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast?.('Akses terbatas khusus Admin!', 'error');
    if (!newCategoryName.trim()) return;

    try {
      const newRef = push(ref(db, 'categories_pengaduan'));
      await set(newRef, { name: newCategoryName.trim() });
      showToast?.('Jenis pengaduan baru berhasil ditambahkan!', 'success');
      setNewCategoryName('');
    } catch (err) {
      showToast?.('Gagal menambah jenis pengaduan.', 'error');
    }
  };

  const handleDeleteCategory = async (catId) => {
    if (!isAdmin) return showToast?.('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('Hapus jenis pengaduan ini?')) {
      try {
        await remove(ref(db, `categories_pengaduan/${catId}`));
        showToast?.('Jenis pengaduan berhasil dihapus!', 'info');
      } catch (err) {
        showToast?.('Gagal menghapus kategori.', 'error');
      }
    }
  };

  // -------------------------------------------------------------
  // EKSPOR LAPORAN PENGADUAN KE PDF
  // -------------------------------------------------------------
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4', compress: true });

      doc.setFillColor(241, 245, 249);
      doc.rect(0, 0, 297, 28, 'F');
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 27, 297, 1, 'F');

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('REKAPITULASI LAPORAN PENGADUAN KPM PKH KABUPATEN TAPIN', 148.5, 12, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Total Pengaduan: ${filteredComplaints.length} Data | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 148.5, 21, { align: 'center' });

      const tableRows = filteredComplaints.map((item, idx) => [
        idx + 1,
        item.dateStr || '-',
        item.namaPengadu,
        item.noTelp,
        item.jenisPengaduan,
        `Kec. ${item.kecamatan}\nDesa ${item.desa}`,
        item.isiPengaduan,
        item.status,
        item.tindakLanjut || '-'
      ]);

      autoTable(doc, {
        startY: 31,
        head: [['No', 'Tanggal', 'Nama Pengadu', 'No. HP', 'Jenis Pengaduan', 'Lokasi', 'Isi Pengaduan', 'Status', 'Tindak Lanjut']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [226, 232, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [0, 0, 0] },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          1: { halign: 'center', cellWidth: 22 },
          2: { cellWidth: 30 },
          3: { halign: 'center', cellWidth: 24 },
          4: { cellWidth: 35 },
          5: { cellWidth: 35 },
          6: { cellWidth: 55 },
          7: { halign: 'center', cellWidth: 20 },
          8: { cellWidth: 40 }
        }
      });

      doc.save(`Laporan_Pengaduan_PKH_Tapin.pdf`);
      showToast?.('Laporan PDF pengaduan berhasil diunduh!', 'success');
    } catch (err) {
      showToast?.('Gagal merender PDF.', 'error');
    }
  };

  // Helper Badge Color
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Baru':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Diproses':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'Selesai':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'Ditolak':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full">
      {/* Header Banner Mobile-First */}
      <div className="p-4 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1 sm:space-y-1.5">
          <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 w-fit">
            <FontAwesomeIcon icon={faHeadset} /> Layanan Pengaduan KPM
          </span>
          <h1 className="text-xl sm:text-3xl font-black text-white tracking-wide leading-snug">
            Pusat Pengaduan & Aspirasi SDM PKH Tapin
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-tight">
            Pencatatan, Monitoring, & Tindak Lanjut Pengaduan KPM Terintegrasi Sekabupaten Tapin
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto flex-wrap">
          <button
            onClick={handleExportPDF}
            className="flex-1 md:flex-none justify-center px-3.5 sm:px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-white/10 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
          >
            <FontAwesomeIcon icon={faFilePdf} className="text-rose-400" />
            <span>Export PDF</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex-1 md:flex-none justify-center px-3.5 sm:px-4 py-2.5 rounded-2xl bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-200 font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-md active:scale-95"
            >
              <FontAwesomeIcon icon={faTag} />
              <span>Kelola Kategori</span>
            </button>
          )}

          <button
            onClick={handleOpenAdd}
            className="w-full md:w-auto justify-center px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-all shadow-lg shadow-indigo-600/30 active:scale-95"
          >
            <FontAwesomeIcon icon={faPlus} />
            <span>Buat Pengaduan Baru</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Statistik Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
            <FontAwesomeIcon icon={faTasks} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold block truncate">Total Pengaduan</span>
            <span className="text-lg sm:text-xl font-black text-white block leading-tight">{complaints.length}</span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-xl flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
            <FontAwesomeIcon icon={faClock} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-amber-300 uppercase font-bold block truncate">Status Baru</span>
            <span className="text-lg sm:text-xl font-black text-amber-300 block leading-tight">
              {complaints.filter((c) => c.status === 'Baru').length}
            </span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
            <FontAwesomeIcon icon={faExclamationCircle} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-cyan-300 uppercase font-bold block truncate">Sedang Diproses</span>
            <span className="text-lg sm:text-xl font-black text-cyan-300 block leading-tight">
              {complaints.filter((c) => c.status === 'Diproses').length}
            </span>
          </div>
        </div>

        <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-900/60 border border-emerald-500/30 backdrop-blur-xl flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-base sm:text-lg shrink-0">
            <FontAwesomeIcon icon={faCheckCircle} />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] sm:text-[10px] text-emerald-300 uppercase font-bold block truncate">Selesai Ditangani</span>
            <span className="text-lg sm:text-xl font-black text-emerald-300 block leading-tight">
              {complaints.filter((c) => c.status === 'Selesai').length}
            </span>
          </div>
        </div>
      </div>

      {/* SMART FILTER BAR WILAYAH KABUPATEN TAPIN */}
      <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl space-y-3 sm:space-y-4">
        <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs sm:text-sm">
          <FontAwesomeIcon icon={faFilter} />
          <span>Smart Filter Wilayah & Kategori (Kabupaten Tapin)</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 sm:gap-3">
          {/* Search Text */}
          <div className="relative">
            <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-slate-500 text-xs" />
            <input
              type="text"
              placeholder="Cari Pengadu / HP / Isi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
            />
          </div>

          {/* Kecamatan Filter */}
          <select
            value={selectedKecamatan}
            onChange={(e) => {
              setSelectedKecamatan(e.target.value);
              setSelectedDesa('');
            }}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Semua Kecamatan --</option>
            {Object.keys(TAPIN_WILAYAH).map((kec) => (
              <option key={kec} value={kec}>Kec. {kec}</option>
            ))}
          </select>

          {/* Desa Filter */}
          <select
            value={selectedDesa}
            onChange={(e) => setSelectedDesa(e.target.value)}
            disabled={!selectedKecamatan}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 disabled:opacity-50 cursor-pointer"
          >
            <option value="">-- Semua Desa/Kel. --</option>
            {selectedKecamatan && TAPIN_WILAYAH[selectedKecamatan].map((des) => (
              <option key={des} value={des}>Desa {des}</option>
            ))}
          </select>

          {/* Kategori Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Semua Jenis --</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2.5 sm:py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
          >
            <option value="">-- Semua Status --</option>
            <option value="Baru">Baru</option>
            <option value="Diproses">Diproses</option>
            <option value="Selesai">Selesai</option>
            <option value="Ditolak">Ditolak</option>
          </select>
        </div>
      </div>

      {/* DAFTAR KARTU PENGADUAN */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filteredComplaints.length > 0 ? (
          filteredComplaints.map((item) => (
            <div
              key={item.id}
              className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-lg hover:border-indigo-500/50 transition-all duration-300 flex flex-col justify-between space-y-3.5 sm:space-y-4 group active:scale-[0.99]"
            >
              <div className="space-y-2.5 sm:space-y-3">
                {/* Header Card */}
                <div className="flex justify-between items-start gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${getStatusBadge(item.status)}`}>
                    {item.status}
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1 shrink-0">
                    <FontAwesomeIcon icon={faCalendarAlt} />
                    <span>{item.dateStr || '-'}</span>
                  </span>
                </div>

                {/* Info Pengadu */}
                <div>
                  <h3 className="font-extrabold text-white text-sm sm:text-base group-hover:text-indigo-300 transition-colors break-words">
                    {item.namaPengadu}
                  </h3>
                  <p className="text-xs text-indigo-300 font-semibold flex items-center gap-1.5 mt-0.5">
                    <FontAwesomeIcon icon={faPhone} className="text-[10px]" />
                    <span>{item.noTelp}</span>
                  </p>
                </div>

                {/* Badges Lokasi & Kategori */}
                <div className="space-y-1.5">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-slate-300 font-medium break-words">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-amber-400 shrink-0" />
                    <span>Desa {item.desa}, Kec. {item.kecamatan}</span>
                  </span>

                  <span className="block w-fit px-2.5 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-300 font-semibold break-words">
                    <FontAwesomeIcon icon={faTag} className="mr-1" />
                    {item.jenisPengaduan}
                  </span>
                </div>

                {/* Isi Pengaduan Preview */}
                <p className="text-xs text-slate-300 line-clamp-3 bg-slate-950/60 p-3 rounded-xl border border-white/5 italic break-words leading-relaxed">
                  "{item.isiPengaduan}"
                </p>
              </div>

              {/* Footer Actions */}
              <div className="pt-3 border-t border-white/10 flex justify-between items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  Petugas: <strong className="text-white">{getStaffName(item.penerimaPengaduan)}</strong>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setDetailModalData(item)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 text-xs transition-all cursor-pointer active:scale-95"
                    title="Rincian Detail"
                  >
                    <FontAwesomeIcon icon={faEye} />
                  </button>

                  <button
                    onClick={() => handleOpenEdit(item)}
                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-amber-300 text-xs transition-all cursor-pointer active:scale-95"
                    title="Edit / Tindak Lanjut"
                  >
                    <FontAwesomeIcon icon={faEdit} />
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-rose-400 text-xs transition-all cursor-pointer active:scale-95"
                      title="Hapus Pengaduan"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-12 sm:py-16 text-slate-400 italic text-xs sm:text-sm border border-dashed border-white/10 rounded-3xl">
            Belum ada data pengaduan yang sesuai dengan filter lokasi/kategori.
          </div>
        )}
      </div>

      {/* MODAL FORM TAMBAH / EDIT PENGADUAN */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-xl p-5 sm:p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl relative space-y-4 sm:space-y-5 animate-fadeIn my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-xl font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faHeadset} className="text-indigo-400" />
              <span>{editingId ? 'Edit & Tindak Lanjut Pengaduan' : 'Form Pengaduan KPM Baru'}</span>
            </h3>

            <form onSubmit={handleSubmitForm} className="space-y-3.5 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Nama Pengadu (KPM)</label>
                  <input
                    type="text"
                    required
                    placeholder="Nama Lengkap KPM / Pengadu"
                    value={form.namaPengadu}
                    onChange={(e) => setForm({ ...form, namaPengadu: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">No. Telepon / WhatsApp</label>
                  <input
                    type="text"
                    required
                    placeholder="0812xxxx"
                    value={form.noTelp}
                    onChange={(e) => setForm({ ...form, noTelp: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Kecamatan (Kab. Tapin)</label>
                  <select
                    value={form.kecamatan}
                    onChange={(e) => handleKecamatanFormChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {Object.keys(TAPIN_WILAYAH).map((kec) => (
                      <option key={kec} value={kec}>Kec. {kec}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Desa / Kelurahan</label>
                  <select
                    value={form.desa}
                    onChange={(e) => setForm({ ...form, desa: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {(TAPIN_WILAYAH[form.kecamatan] || []).map((des) => (
                      <option key={des} value={des}>Desa {des}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Jenis Pengaduan</label>
                  <select
                    value={form.jenisPengaduan}
                    onChange={(e) => setForm({ ...form, jenisPengaduan: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Status Progres</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="Baru">Baru Ditambah</option>
                    <option value="Diproses">Sedang Diproses</option>
                    <option value="Selesai">Selesai Ditangani</option>
                    <option value="Ditolak">Ditolak / Tidak Valid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Isi Rincian Pengaduan</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Tuliskan keluhan atau masalah yang dihadapi KPM..."
                  value={form.isiPengaduan}
                  onChange={(e) => setForm({ ...form, isiPengaduan: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-amber-300 block mb-1">Tindak Lanjut & Solusi (Opsional)</label>
                <textarea
                  rows="2"
                  placeholder="Catatan penanganan atau solusi yang sudah dilakukan SDM..."
                  value={form.tindakLanjut}
                  onChange={(e) => setForm({ ...form, tindakLanjut: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-amber-500/30 text-white text-xs outline-none focus:border-amber-400"
                ></textarea>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Penerima / Petugas Pendamping SDM</label>
                <select
                  value={form.penerimaPengaduan}
                  onChange={(e) => setForm({ ...form, penerimaPengaduan: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="">-- Pilih SDM Pendamping --</option>
                  {staffList.map((s) => {
                    const sName = typeof s === 'object' ? s.name || s.NAMA || s.nama || s.id : s;
                    const sId = typeof s === 'object' ? s.id || s.key || s.name : s;
                    return <option key={sId} value={sId}>{sName}</option>;
                  })}
                </select>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                >
                  <FontAwesomeIcon icon={faSave} />
                  <span>Simpan Data</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELOLA KATEGORI JENIS PENGADUAN (KHUSUS ADMIN) */}
      {isCategoryModalOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-5 sm:p-6 rounded-3xl bg-slate-900 border border-purple-500/40 shadow-2xl relative space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsCategoryModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faTag} className="text-purple-400" />
              <span>Kelola Jenis Pengaduan</span>
            </h3>

            <form onSubmit={handleAddCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="Nama Jenis Pengaduan Baru..."
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer active:scale-95"
              >
                Tambah
              </button>
            </form>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
              {categories.map((c) => (
                <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex justify-between items-center text-xs text-slate-200">
                  <span className="truncate mr-2">{c.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer shrink-0"
                  >
                    <FontAwesomeIcon icon={faTrashAlt} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL RINCIAN PENGADUAN */}
      {detailModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-5 sm:p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl relative space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setDetailModalData(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <div className="flex justify-between items-center pr-8">
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold border ${getStatusBadge(detailModalData.status)}`}>
                {detailModalData.status}
              </span>
              <span className="text-xs text-slate-400">{detailModalData.dateStr || '-'}</span>
            </div>

            <div className="space-y-3 border-t border-b border-white/10 py-3.5">
              <div>
                <span className="text-[10px] text-slate-400 font-bold block">Nama Pengadu / KPM</span>
                <span className="text-sm sm:text-base font-bold text-white block break-words">{detailModalData.namaPengadu}</span>
                <span className="text-xs text-indigo-300 block font-semibold">{detailModalData.noTelp}</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 block">Lokasi Wilayah</span>
                  <span className="font-semibold text-slate-200 block break-words">Desa {detailModalData.desa}, Kec. {detailModalData.kecamatan}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Jenis Pengaduan</span>
                  <span className="font-semibold text-purple-300 block break-words">{detailModalData.jenisPengaduan}</span>
                </div>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Rincian Keluhan</span>
                <p className="text-xs text-slate-200 bg-slate-950 p-3 rounded-xl border border-white/10 whitespace-pre-line break-words leading-relaxed">
                  {detailModalData.isiPengaduan}
                </p>
              </div>

              <div>
                <span className="text-[10px] text-amber-400 font-bold block mb-1">Status Tindak Lanjut</span>
                <p className="text-xs text-amber-200 bg-amber-950/40 p-3 rounded-xl border border-amber-500/30 whitespace-pre-line break-words leading-relaxed">
                  {detailModalData.tindakLanjut || 'Belum ada catatan tindak lanjut.'}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 gap-2">
              <span className="truncate">Penerima: <strong className="text-white">{getStaffName(detailModalData.penerimaPengaduan)}</strong></span>
              <button
                onClick={() => setDetailModalData(null)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer shrink-0 active:scale-95"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}