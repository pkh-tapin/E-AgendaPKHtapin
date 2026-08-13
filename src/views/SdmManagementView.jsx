import React, { useState, useEffect, useMemo } from 'react';
import { db, ref, push, update, remove, set } from '../firebase';
import { useToast } from '../context/ToastContext';
import * as XLSX from 'xlsx';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faUserPlus, 
  faTrash, 
  faEdit, 
  faFileExcel, 
  faLock, 
  faCog, 
  faSave, 
  faUsers, 
  faSignature, 
  faSlidersH, 
  faCalendarMinus, 
  faCloudDownloadAlt,
  faSpinner,
  faCheckCircle,
  faListCheck,
  faPlus,
  faMapMarkerAlt,
  faFilter,
  faSearch,
  faMapMarkedAlt,
  faBuilding,
  faFolderPlus,
  faUpload,
  faDownload,
  faBroom,
  faIdCard,
  faPhone,
  faBriefcase,
  faCreditCard,
  faCalendarAlt,
  faUserCheck,
  faFileExport
} from '@fortawesome/free-solid-svg-icons';

// WILAYAH DEFAULT KOSONG
const DEFAULT_TAPIN_WILAYAH = {};

// DAFTAR NAMA DUMMY BAWAAN UNTUK DISARING TOTAL
const DUMMY_SAMPLE_NAMES = ['ahmad', 'budi', 'siti', 'dewi', 'eko', 'fajar', 'gita', 'hadi'];

// HANYA 3 JABATAN SDM PKH RESMI
const LIST_JABATAN_PKH = [
  "Ketua Tim Kabupaten",
  "Ketua Tim Kecamatan",
  "Pendamping Sosial"
];

const LIST_STATUS_PEGAWAI = [
  "Non-ASN / Kontrak",
  "PPPK",
  "PNS / ASN",
  "Honor Daerah"
];

// HELPER PARSING ARRAY DESA
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

export default function SdmManagementView({ staffList = [], config = {}, holidays = {}, isAdmin, onOpenLogin }) {
  const { showToast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('crud_sdm');

  // Master Data Wilayah Dinamis
  const [wilayahData, setWilayahData] = useState(config.wilayah || DEFAULT_TAPIN_WILAYAH);

  // NORMALISASI MASTER DATA SDM MURNI DARI FIREBASE (SUPPORT COMPATIBILITY NIP/NIK LAMA)
  const cleanStaffList = useMemo(() => {
    if (!staffList) return [];
    let list = [];
    
    if (Array.isArray(staffList)) {
      list = staffList.map((item, index) => {
        if (typeof item === 'string') {
          return { id: String(index), name: item, jabatan: 'Pendamping Sosial', statusPegawai: 'Non-ASN / Kontrak', isDummyString: true };
        }
        const realId = item.id || item.key || item._id || item.firebaseKey || String(index);
        const resolvedNip = item.NIP || item.nip || item.Nip || item.nik || item.NIK || '-';
        return { 
          ...item, 
          NIP: resolvedNip,
          id: String(realId)
        };
      });
    } else if (typeof staffList === 'object' && staffList !== null) {
      list = Object.entries(staffList).map(([key, val]) => {
        if (typeof val === 'string') {
          return { id: key, name: val, jabatan: 'Pendamping Sosial', statusPegawai: 'Non-ASN / Kontrak', isDummyString: true };
        }
        const resolvedNip = val.NIP || val.nip || val.Nip || val.nik || val.NIK || '-';
        return { 
          ...val, 
          NIP: resolvedNip,
          id: key 
        };
      });
    }

    // Hanya mereturn data murni yang sah
    return list.filter(s => {
      if (!s || !s.name || typeof s.name !== 'string' || s.name.trim() === '') return false;
      
      if (s.isDummyString) return false;

      const lowerName = s.name.toLowerCase().trim();
      const isSampleName = DUMMY_SAMPLE_NAMES.includes(lowerName);
      const isNumericId = !s.id || s.id.length < 5;
      const hasNoDetails = (!s.NIP || s.NIP === '-') && (!s.phone || s.phone === '-');

      if (isSampleName && isNumericId && hasNoDetails) {
        return false;
      }

      return true;
    });
  }, [staffList]);

  // State SDM Tambah Manual
  const [name, setName] = useState('');
  const [NIP, setNIP] = useState('');
  const [jabatan, setJabatan] = useState('Pendamping Sosial');
  const [statusPegawai, setStatusPegawai] = useState('Non-ASN / Kontrak');
  const [tmt, setTmt] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [rekening, setRekening] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [selectedDesa, setSelectedDesa] = useState([]);

  // State Edit SDM
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNIP, setEditNIP] = useState('');
  const [editJabatan, setEditJabatan] = useState('Pendamping Sosial');
  const [editStatusPegawai, setEditStatusPegawai] = useState('Non-ASN / Kontrak');
  const [editTmt, setEditTmt] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRekening, setEditRekening] = useState('');
  const [editAlamat, setEditAlamat] = useState('');
  const [editKecamatan, setEditKecamatan] = useState('');
  const [editDesa, setEditDesa] = useState([]);

  // State Smart Filter SDM
  const [filterSearch, setFilterSearch] = useState('');
  const [filterKecamatan, setFilterKecamatan] = useState('');
  const [filterDesa, setFilterDesa] = useState('');
  const [filterJabatan, setFilterJabatan] = useState('');
  const [filterStatusPegawai, setFilterStatusPegawai] = useState('');

  // State Hari Libur CRUD
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayTitle, setHolidayTitle] = useState('');
  const [editingHolidayDate, setEditingHolidayDate] = useState(null);
  const [editingHolidayTitle, setEditingHolidayTitle] = useState('');
  const [isSyncingHolidays, setIsSyncingHolidays] = useState(false);

  // State Config Rules Dinamis
  const [minWorkdaysForDoublePiket, setMinWorkdaysForDoublePiket] = useState(config.minWorkdaysForDoublePiket ?? 13);
  const [piketSeninQuota, setPiketSeninQuota] = useState(config.piketSeninQuota ?? 0);
  const [piketHarianQuota, setPiketHarianQuota] = useState(config.piketHarianQuota ?? 0);

  // State Meta TTD PDF
  const [signerTitle, setSignerTitle] = useState(config.signerTitle || '');
  const [signerName, setSignerName] = useState(config.signerName || '');
  const [signatureImg, setSignatureImg] = useState(config.signerSignatureImg || '');

  // State CRUD Catatan Tugas Piket
  const [piketNotes, setPiketNotes] = useState(config.piketNotes || []);
  const [newNoteInput, setNewNoteInput] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');

  // STATE DATABASE WILAYAH
  const [newKecName, setNewKecName] = useState('');
  const [targetKecForDesa, setTargetKecForDesa] = useState('');
  const [newDesaName, setNewDesaName] = useState('');
  
  // State Edit Kecamatan / Desa
  const [editingKecKey, setEditingKecKey] = useState(null);
  const [editingKecValue, setEditingKecValue] = useState('');
  const [editingDesaLocation, setEditingDesaLocation] = useState(null);
  const [editingDesaValue, setEditingDesaValue] = useState('');

  useEffect(() => {
    if (config) {
      if (config.wilayah && Object.keys(config.wilayah).length > 0) {
        setWilayahData(config.wilayah);
        const defaultKec = Object.keys(config.wilayah)[0] || '';
        setKecamatan((prev) => prev || defaultKec);
        setTargetKecForDesa((prev) => prev || defaultKec);
      } else {
        setWilayahData({});
      }
      setMinWorkdaysForDoublePiket(config.minWorkdaysForDoublePiket ?? 13);
      setPiketSeninQuota(config.piketSeninQuota ?? 0);
      setPiketHarianQuota(config.piketHarianQuota ?? 0);
      setSignerTitle(config.signerTitle || '');
      setSignerName(config.signerName || '');
      setSignatureImg(config.signerSignatureImg || '');
      if (config.piketNotes) setPiketNotes(config.piketNotes);
      else setPiketNotes([]);
    }
  }, [config]);

  if (!isAdmin) {
    return (
      <div className="p-6 sm:p-12 text-center rounded-3xl bg-slate-900/80 border border-rose-500/30 backdrop-blur-xl shadow-3d-glass max-w-lg mx-auto mt-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 text-3xl shadow-3d-glass">
          <FontAwesomeIcon icon={faLock} />
        </div>
        <h3 className="text-xl font-extrabold text-white mb-2">Akses Terkunci</h3>
        <p className="text-xs sm:text-sm text-slate-300 mb-6">
          Menu **Kelola SDM & Pengaturan System** hanya dapat diakses oleh Administrator.
        </p>
        <button
          onClick={onOpenLogin}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-bold text-sm shadow-3d-button transition-all cursor-pointer"
        >
          Masuk Mode Admin
        </button>
      </div>
    );
  }

  // SIMPAN MASTER WILAYAH KE FIREBASE
  const saveWilayahToFirebase = async (updatedWilayah) => {
    try {
      setWilayahData(updatedWilayah);
      await set(ref(db, 'config/wilayah'), updatedWilayah);
      showToast('Database Master Wilayah diperbarui secara Realtime!', 'success');
    } catch (err) {
      showToast('Gagal menyimpan perubahan wilayah ke Firebase Database.', 'error');
    }
  };

  const handleAddKecamatan = (e) => {
    e.preventDefault();
    const formattedKec = newKecName.trim();
    if (!formattedKec) return showToast('Masukkan nama kecamatan!', 'error');
    if (wilayahData[formattedKec]) return showToast('Kecamatan sudah ada!', 'error');

    const updated = { ...wilayahData, [formattedKec]: [] };
    saveWilayahToFirebase(updated);
    setNewKecName('');
    if (!targetKecForDesa) setTargetKecForDesa(formattedKec);
    if (!kecamatan) setKecamatan(formattedKec);
  };

  const handleUpdateKecamatan = (oldKec) => {
    const formatted = editingKecValue.trim();
    if (!formatted) return showToast('Nama kecamatan tidak boleh kosong!', 'error');
    if (formatted !== oldKec && wilayahData[formatted]) return showToast('Nama kecamatan sudah ada!', 'error');

    const updated = {};
    Object.keys(wilayahData).forEach((k) => {
      if (k === oldKec) updated[formatted] = wilayahData[oldKec];
      else updated[k] = wilayahData[k];
    });

    saveWilayahToFirebase(updated);
    setEditingKecKey(null);
    setEditingKecValue('');
  };

  const handleDeleteKecamatan = (kecName) => {
    if (window.confirm(`Hapus Kecamatan "${kecName}" beserta seluruh desanya?`)) {
      const updated = { ...wilayahData };
      delete updated[kecName];
      saveWilayahToFirebase(updated);
    }
  };

  const handleAddDesaToKec = (e) => {
    e.preventDefault();
    const formattedDesa = newDesaName.trim();
    if (!formattedDesa) return showToast('Masukkan nama desa!', 'error');
    if (!targetKecForDesa || !wilayahData[targetKecForDesa]) return showToast('Pilih kecamatan yang valid!', 'error');

    const currentList = wilayahData[targetKecForDesa] || [];
    if (currentList.includes(formattedDesa)) return showToast('Desa sudah ada di kecamatan ini!', 'error');

    const updated = {
      ...wilayahData,
      [targetKecForDesa]: [...currentList, formattedDesa]
    };
    saveWilayahToFirebase(updated);
    setNewDesaName('');
  };

  const handleUpdateDesa = (kecName, index) => {
    const formatted = editingDesaValue.trim();
    if (!formatted) return showToast('Nama desa tidak boleh kosong!', 'error');

    const currentList = [...(wilayahData[kecName] || [])];
    currentList[index] = formatted;

    const updated = { ...wilayahData, [kecName]: currentList };
    saveWilayahToFirebase(updated);
    setEditingDesaLocation(null);
    setEditingDesaValue('');
  };

  const handleDeleteDesa = (kecName, index) => {
    const desName = wilayahData[kecName]?.[index];
    if (window.confirm(`Hapus Desa "${desName}" dari Kecamatan ${kecName}?`)) {
      const currentList = (wilayahData[kecName] || []).filter((_, i) => i !== index);
      const updated = { ...wilayahData, [kecName]: currentList };
      saveWilayahToFirebase(updated);
    }
  };

  const handleMasterWilayahExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        const updated = { ...wilayahData };
        let addedCount = 0;

        data.forEach((row) => {
          if (row && row[0] && typeof row[0] === 'string') {
            const rowKec = row[0].trim();
            if (rowKec.toLowerCase() !== 'kecamatan' && rowKec.toLowerCase() !== 'nama kecamatan') {
              if (!updated[rowKec]) updated[rowKec] = [];

              if (row[1]) {
                let desList = [];
                if (typeof row[1] === 'string') {
                  desList = row[1].split(',').map((d) => d.trim()).filter(Boolean);
                } else if (Array.isArray(row[1])) {
                  desList = row[1];
                }

                desList.forEach((d) => {
                  if (!updated[rowKec].includes(d)) {
                    updated[rowKec].push(d);
                    addedCount++;
                  }
                });
              }
            }
          }
        });

        await saveWilayahToFirebase(updated);
        showToast(`Master Wilayah diperbarui (${addedCount} Desa Baru Terimport)!`, 'success');
      } catch (err) {
        showToast('Gagal membaca file Excel master wilayah!', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const downloadWilayahExcelTemplate = () => {
    const templateData = [
      ["Kecamatan", "Desa"],
      ["Contoh Kec. A", "Desa 1, Desa 2, Desa 3"],
      ["Contoh Kec. B", "Desa 4, Desa 5"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Master_Wilayah");
    XLSX.writeFile(wb, "Template_Master_Wilayah.xlsx");
    showToast("Template Excel Master Wilayah diunduh!", "info");
  };

  const handleClearAllWilayah = async () => {
    if (window.confirm("PERINGATAN KRUSIAL: Kosongkan seluruh Database Wilayah Kecamatan & Desa? Data akan terhapus total tanpa tersisa!")) {
      try {
        await remove(ref(db, 'config/wilayah'));
        setWilayahData({});
        setKecamatan('');
        setTargetKecForDesa('');
        showToast("Master Wilayah berhasil dikosongkan total!", "info");
      } catch (err) {
        showToast("Gagal mengosongkan master wilayah.", "error");
      }
    }
  };

  const downloadSdmExcelTemplate = () => {
    const templateData = [
      ["Nama SDM", "NIP", "Jabatan", "Status Pegawai", "TMT Mulai", "No HP / WA", "Email", "No Rekening", "Alamat", "Kecamatan", "Desa"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Database_SDM_PKH");
    XLSX.writeFile(wb, "Template_Import_SDM_PKH.xlsx");
    showToast("Template Excel SDM diunduh!", "info");
  };

  const exportAllSdmToExcel = () => {
    if (!cleanStaffList || cleanStaffList.length === 0) return showToast('Tidak ada data SDM untuk diexport!', 'warning');
    const exportData = cleanStaffList.map((s, idx) => {
      const sKecClean = s.kecamatan || '-';
      const desaList = parseDesaArray(s.desa);
      const sNipResolved = s.NIP || s.nip || s.nik || s.NIK || '-';
      return {
        "No": idx + 1,
        "Nama Lengkap": s.name || s.id || '-',
        "NIP": sNipResolved,
        "Jabatan": s.jabatan || 'Pendamping Sosial',
        "Status Pegawai": s.statusPegawai || 'Non-ASN / Kontrak',
        "TMT Mulai": s.tmt || '-',
        "No HP / WA": s.phone || '-',
        "Email": s.email || '-',
        "Kecamatan Tugas": sKecClean || '-',
        "Desa Pendampingan": desaList.join(', ') || '-',
        "No. Rekening Bank": s.rekening || '-',
        "Alamat": s.alamat || '-'
      };
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data_SDM_Lengkap");
    XLSX.writeFile(wb, `Export_Biodata_SDM_PKH_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Data SDM berhasil di-export ke Excel!', 'success');
  };

  // MENGHAPUS TOTAL SELURUH DATA SDM DI FIREBASE (BERSIH 100% REALTIME)
  const handleClearAllStaff = async () => {
    if (window.confirm("PERINGATAN KRUSIAL: Apakah Anda yakin ingin MENGHAPUS TOTAL SELURUH DATA SDM TERDAFTAR di Database? Data akan terhapus bersih 100% tanpa ada sisa!")) {
      try {
        await remove(ref(db, 'staff'));
        await set(ref(db, 'staff'), null);
        showToast("Database SDM telah dibersihkan total tanpa sisa!", "info");
      } catch (err) {
        showToast("Gagal membersihkan data SDM.", "error");
      }
    }
  };

  const handleKecamatanAddChange = (val) => {
    setKecamatan(val);
    const availDesa = wilayahData[val] || [];
    setSelectedDesa(availDesa.length > 0 ? [availDesa[0]] : []);
  };

  const handleDesaToggleAdd = (desName) => {
    setSelectedDesa((prev) =>
      prev.includes(desName) ? prev.filter((d) => d !== desName) : [...prev, desName]
    );
  };

  // MULAI EDIT SDM
  const handleStartEditStaff = (staff) => {
    if (!staff || !staff.id) {
      showToast('Error: Key ID SDM tidak valid.', 'error');
      return;
    }

    const nipVal = staff.NIP || staff.nip || staff.nik || staff.NIK || '';

    setEditingId(staff.id);
    setEditName(staff.name || '');
    setEditNIP(nipVal && nipVal !== '-' ? nipVal : '');
    setEditJabatan(staff.jabatan || 'Pendamping Sosial');
    setEditStatusPegawai(staff.statusPegawai || 'Non-ASN / Kontrak');
    setEditTmt(staff.tmt && staff.tmt !== '-' ? staff.tmt : '');
    setEditPhone(staff.phone && staff.phone !== '-' ? staff.phone : '');
    setEditEmail(staff.email && staff.email !== '-' ? staff.email : '');
    setEditRekening(staff.rekening && staff.rekening !== '-' ? staff.rekening : '');
    setEditAlamat(staff.alamat && staff.alamat !== '-' ? staff.alamat : '');
    setEditKecamatan(staff.kecamatan && staff.kecamatan !== '-' ? staff.kecamatan : '');
    setEditDesa(parseDesaArray(staff.desa));
  };

  const handleKecamatanEditChange = (val) => {
    setEditKecamatan(val);
    const availDesa = wilayahData[val] || [];
    setEditDesa(availDesa.length > 0 ? [availDesa[0]] : []);
  };

  const handleDesaToggleEdit = (desName) => {
    setEditDesa((prev) =>
      prev.includes(desName) ? prev.filter((d) => d !== desName) : [...prev, desName]
    );
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    set(ref(db, 'config'), {
      ...config,
      minWorkdaysForDoublePiket: Number(minWorkdaysForDoublePiket),
      piketSeninQuota: Number(piketSeninQuota),
      piketHarianQuota: Number(piketHarianQuota),
      signerTitle: signerTitle.trim(),
      signerName: signerName.trim(),
      signerSignatureImg: signatureImg,
      piketNotes,
      wilayah: wilayahData
    });
    showToast('Aturan Acak Piket & Pengaturan Admin berhasil disimpan!', 'success');
  };

  const handleAddNote = (e) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return showToast('Masukkan teks catatan!', 'error');
    const updated = [...piketNotes, newNoteInput.trim()];
    setPiketNotes(updated);
    set(ref(db, 'config/piketNotes'), updated);
    setNewNoteInput('');
    showToast('Catatan tugas piket ditambahkan!', 'success');
  };

  const handleUpdateNote = (index) => {
    if (!editingNoteText.trim()) return showToast('Teks tidak boleh kosong!', 'error');
    const updated = [...piketNotes];
    updated[index] = editingNoteText.trim();
    setPiketNotes(updated);
    set(ref(db, 'config/piketNotes'), updated);
    setEditingNoteIndex(null);
    setEditingNoteText('');
    showToast('Catatan tugas piket diperbarui!', 'success');
  };

  const handleDeleteNote = (index) => {
    if (window.confirm('Hapus catatan tugas piket ini?')) {
      const updated = piketNotes.filter((_, i) => i !== index);
      setPiketNotes(updated);
      set(ref(db, 'config/piketNotes'), updated);
      showToast('Catatan tugas piket dihapus!', 'info');
    }
  };

  const handleSyncOnlineHolidays = async () => {
    setIsSyncingHolidays(true);
    let holidaysToSave = {};

    try {
      const response = await fetch('https://dayoffapi.vercel.app/api?year=2026', { mode: 'cors' });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((item) => {
            if (item.tanggal) {
              holidaysToSave[item.tanggal] = item.keterangan || item.summary || 'Hari Libur Nasional';
            }
          });
        }
      }
    } catch (e) {
      console.warn("Koneksi API Libur bermasalah...");
    }

    if (Object.keys(holidaysToSave).length === 0) {
      return showToast('Gagal menarik tanggal merah dari API online.', 'error');
    }

    try {
      await set(ref(db, 'config/holidays'), holidaysToSave);
      showToast(`Berhasil menyimpan ${Object.keys(holidaysToSave).length} Tanggal Merah 2026!`, 'success');
    } catch (err) {
      showToast('Gagal menyimpan ke Firebase Database.', 'error');
    } finally {
      setIsSyncingHolidays(false);
    }
  };

  const handleSaveHoliday = (e) => {
    e.preventDefault();
    if (!holidayDate || !holidayTitle.trim()) {
      return showToast('Lengkapi tanggal dan keterangan libur!', 'error');
    }

    try {
      set(ref(db, `config/holidays/${holidayDate}`), holidayTitle.trim());
      showToast(`Hari libur "${holidayTitle}" berhasil disimpan!`, 'success');
      setHolidayDate('');
      setHolidayTitle('');
      setEditingHolidayDate(null);
    } catch (err) {
      showToast('Gagal menyimpan tanggal merah.', 'error');
    }
  };

  const handleEditHolidayClick = (dateStr, currentTitle) => {
    setEditingHolidayDate(dateStr);
    setEditingHolidayTitle(typeof currentTitle === 'string' ? currentTitle : currentTitle?.title || '');
  };

  const handleUpdateHolidaySubmit = (dateStr) => {
    if (!editingHolidayTitle.trim()) return showToast('Keterangan tidak boleh kosong!', 'error');
    set(ref(db, `config/holidays/${dateStr}`), editingHolidayTitle.trim());
    showToast('Keterangan hari libur diperbarui!', 'success');
    setEditingHolidayDate(null);
    setEditingHolidayTitle('');
  };

  const handleDeleteHoliday = (dateStr) => {
    if (window.confirm(`Hapus tanggal merah ${dateStr}?`)) {
      try {
        remove(ref(db, `config/holidays/${dateStr}`));
        showToast('Hari libur berhasil dihapus!', 'info');
      } catch (err) {
        showToast('Gagal menghapus tanggal merah.', 'error');
      }
    }
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setSignatureImg(reader.result);
      showToast('TTD Digital berhasil diunggah!', 'success');
    };
    reader.readAsDataURL(file);
  };

  // TAMBAH SDM MANUAL KE FIREBASE REALTIME
  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!name.trim()) return showToast('Masukkan nama SDM!', 'error');

    let finalDesa = selectedDesa;
    if ((!finalDesa || finalDesa.length === 0) && kecamatan && wilayahData[kecamatan]) {
      const availDesa = wilayahData[kecamatan] || [];
      finalDesa = availDesa.length > 0 ? [availDesa[0]] : [];
    }

    try {
      await push(ref(db, 'staff'), { 
        name: name.trim(),
        NIP: NIP.trim() || '-',
        jabatan: jabatan || 'Pendamping Sosial',
        statusPegawai: statusPegawai || 'Non-ASN / Kontrak',
        tmt: tmt || '-',
        phone: phone.trim() || '-',
        email: email.trim() || '-',
        rekening: rekening.trim() || '-',
        alamat: alamat.trim() || '-',
        kecamatan: kecamatan.trim() || '-',
        desa: finalDesa.length > 0 ? finalDesa : ['-']
      });
      showToast(`SDM "${name.trim()}" berhasil disimpan ke Database Realtime!`, 'success');
      setName('');
      setNIP('');
      setTmt('');
      setPhone('');
      setEmail('');
      setRekening('');
      setAlamat('');
      setSelectedDesa([]);
    } catch (err) {
      showToast(`Gagal Tambah SDM: ${err.message}`, 'error');
    }
  };

  // AUTO-IMPORT SDM EXCEL
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let addedCount = 0;
        for (const row of data) {
          if (row && row[0] && typeof row[0] === 'string') {
            const staffName = row[0].trim();
            if (staffName.toLowerCase() !== 'nama' && 
                staffName.toLowerCase() !== 'nama sdm' && 
                staffName.toLowerCase() !== 'nama lengkap' &&
                staffName.toLowerCase() !== 'nama sdm / petugas') {
              
              const rowNIP = row[1] ? String(row[1]).trim() : '-';
              const rowJabatan = row[2] ? String(row[2]).trim() : 'Pendamping Sosial';
              const rowStatus = row[3] ? String(row[3]).trim() : 'Non-ASN / Kontrak';
              const rowTmt = row[4] ? String(row[4]).trim() : '-';
              const rowPhone = row[5] ? String(row[5]).trim() : '-';
              const rowEmail = row[6] && String(row[6]).includes('@') ? String(row[6]).trim() : '-';
              const rowRekening = row[7] ? String(row[7]).trim() : '-';
              const rowAlamat = row[8] ? String(row[8]).trim() : '-';
              const rowKec = row[9] ? String(row[9]).trim() : '-';
              
              let rowDesa = [];
              const rawDesaCol = row[10];
              if (rawDesaCol) {
                if (Array.isArray(rawDesaCol)) {
                  rowDesa = rawDesaCol.map(String);
                } else if (typeof rawDesaCol === 'string') {
                  rowDesa = rawDesaCol.split(',').map((d) => d.trim()).filter(Boolean);
                }
              }
              rowDesa = rowDesa.map(d => d.replace(/^Desa\s*/i, '').trim()).filter(Boolean);

              await push(ref(db, 'staff'), { 
                name: staffName,
                NIP: rowNIP,
                jabatan: rowJabatan,
                statusPegawai: rowStatus,
                tmt: rowTmt,
                phone: rowPhone,
                email: rowEmail,
                rekening: rowRekening,
                alamat: rowAlamat,
                kecamatan: rowKec,
                desa: rowDesa.length > 0 ? rowDesa : ['-']
              });
              addedCount++;
            }
          }
        }

        if (addedCount > 0) showToast(`Berhasil mengimpor ${addedCount} SDM ke Database Realtime!`, 'success');
      } catch (err) {
        showToast('Gagal membaca file Excel SDM!', 'error');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // UPDATE DATA SDM PERMANEN & INSTANT BERUBAH DI FIREBASE DAN TAMPILAN KARTU
  const handleUpdateStaff = async (id) => {
    if (!id) {
      showToast('Gagal memperbarui: ID SDM tidak ditemukan!', 'error');
      return;
    }
    if (!editName.trim()) return showToast('Nama tidak boleh kosong!', 'error');

    const payload = { 
      name: editName.trim(),
      NIP: editNIP.trim() || '-',
      jabatan: editJabatan || 'Pendamping Sosial',
      statusPegawai: editStatusPegawai || 'Non-ASN / Kontrak',
      tmt: editTmt || '-',
      phone: editPhone.trim() || '-',
      email: editEmail.trim() || '-',
      rekening: editRekening.trim() || '-',
      alamat: editAlamat.trim() || '-',
      kecamatan: editKecamatan.trim() || '-',
      desa: editDesa && editDesa.length > 0 ? editDesa : ['-']
    };

    try {
      await update(ref(db, `staff/${id}`), payload);
      showToast(`Biodata SDM "${editName.trim()}" berhasil diperbarui!`, 'success');
      setEditingId(null);
    } catch (err) {
      console.error("Gagal update staff:", err);
      try {
        await set(ref(db, `staff/${id}`), payload);
        showToast(`Biodata SDM "${editName.trim()}" berhasil diperbarui!`, 'success');
        setEditingId(null);
      } catch (setErr) {
        showToast(`Gagal Simpan: ${setErr.message}`, 'error');
      }
    }
  };

  const handleDeleteStaff = (id, staffName) => {
    if (!id) return;
    if (window.confirm(`Hapus SDM "${staffName}"?`)) {
      remove(ref(db, `staff/${id}`));
      showToast(`SDM "${staffName}" telah dihapus!`, 'info');
    }
  };

  const getHolidayText = (val) => {
    if (typeof val === 'string') return val;
    return val?.title || val?.keterangan || 'Hari Libur';
  };

  const holidayList = Object.entries(holidays || {}).sort(([a], [b]) => a.localeCompare(b));

  // SMART FILTER SINKRONISASI
  const filteredStaffList = useMemo(() => {
    return cleanStaffList.filter((s) => {
      const sName = s.name || '';
      const sNIP = s.NIP || s.nip || s.nik || s.NIK || '';
      const sPhone = s.phone || '';
      const sJabatan = s.jabatan || '';
      const sStatus = s.statusPegawai || '';
      const sKec = s.kecamatan || '';
      const sDesaArray = parseDesaArray(s.desa);

      const query = filterSearch.toLowerCase().trim();
      const matchSearch = !query || 
        sName.toLowerCase().includes(query) ||
        sNIP.toLowerCase().includes(query) ||
        sPhone.includes(query) ||
        sJabatan.toLowerCase().includes(query);

      const matchKec = !filterKecamatan || sKec.toLowerCase().trim() === filterKecamatan.toLowerCase().trim();
      const matchDesa = !filterDesa || sDesaArray.some(d => d.toLowerCase().trim() === filterDesa.toLowerCase().trim());
      const matchJabatan = !filterJabatan || sJabatan === filterJabatan;
      const matchStatus = !filterStatusPegawai || sStatus === filterStatusPegawai;

      return matchSearch && matchKec && matchDesa && matchJabatan && matchStatus;
    });
  }, [cleanStaffList, filterSearch, filterKecamatan, filterDesa, filterJabatan, filterStatusPegawai]);

  // Option Kecamatan Gabungan
  const allKecOptions = useMemo(() => {
    return Array.from(new Set([
      ...Object.keys(wilayahData),
      ...cleanStaffList.map(s => s.kecamatan).filter(k => k && k !== '-')
    ]));
  }, [wilayahData, cleanStaffList]);

  // Option Desa Terhubung Berdasarkan Kecamatan
  const availableDesaFilter = useMemo(() => {
    if (!filterKecamatan) return [];
    const fromMaster = wilayahData[filterKecamatan] || [];
    const fromStaff = cleanStaffList
      .filter(s => (s.kecamatan || '').toLowerCase().trim() === filterKecamatan.toLowerCase().trim())
      .flatMap(s => parseDesaArray(s.desa));
    return Array.from(new Set([...fromMaster, ...fromStaff])).filter(Boolean);
  }, [filterKecamatan, wilayahData, cleanStaffList]);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full">
      {/* HEADER WIDGET STATISTIK REALTIME */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900/60 to-slate-900/80 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-lg">
            <FontAwesomeIcon icon={faUsers} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total SDM PKH</span>
            <span className="text-lg font-extrabold text-white">{cleanStaffList.length} Orang</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900/60 to-slate-900/80 border border-emerald-500/30 backdrop-blur-xl shadow-3d-glass flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-lg">
            <FontAwesomeIcon icon={faMapMarkedAlt} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Kec. Tercover</span>
            <span className="text-lg font-extrabold text-white">{Object.keys(wilayahData).length} Kec.</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-900/60 to-slate-900/80 border border-amber-500/30 backdrop-blur-xl shadow-3d-glass flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-lg">
            <FontAwesomeIcon icon={faBriefcase} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Pendamping Sosial</span>
            <span className="text-lg font-extrabold text-white">
              {cleanStaffList.filter(s => (s.jabatan || '').includes('Pendamping')).length} Orang
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-900/60 to-slate-900/80 border border-purple-500/30 backdrop-blur-xl shadow-3d-glass flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold text-lg">
            <FontAwesomeIcon icon={faUserCheck} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Ketua Tim SDM</span>
            <span className="text-lg font-extrabold text-white">
              {cleanStaffList.filter(s => (s.jabatan || '').includes('Ketua Tim')).length} Orang
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tab Navigation */}
      <div className="flex gap-2 sm:gap-4 border-b border-white/10 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('crud_sdm')}
          className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'crud_sdm'
              ? 'bg-indigo-600 text-white shadow-3d-button'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faUsers} className="mr-2" />
          <span>Kelola & Import SDM</span>
        </button>

        <button
          onClick={() => setActiveSubTab('database_wilayah')}
          className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'database_wilayah'
              ? 'bg-amber-600 text-white shadow-3d-button'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faMapMarkedAlt} className="mr-2" />
          <span>Database Desa & Kec.</span>
        </button>

        <button
          onClick={() => setActiveSubTab('holidays')}
          className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'holidays'
              ? 'bg-rose-600 text-white shadow-3d-button'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faCalendarMinus} className="mr-2" />
          <span>Hari Libur / Tanggal Merah</span>
        </button>

        <button
          onClick={() => setActiveSubTab('pengaturan')}
          className={`px-4 sm:px-5 py-2.5 rounded-2xl font-bold text-xs sm:text-sm whitespace-nowrap transition-all cursor-pointer ${
            activeSubTab === 'pengaturan'
              ? 'bg-purple-600 text-white shadow-3d-button'
              : 'bg-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faCog} className="mr-2" />
          <span>Pengaturan System & Rules Piket</span>
        </button>
      </div>

      {/* SUB TAB 1: CRUD SDM BIODATA LENGKAP & SMART FILTER WILAYAH */}
      {activeSubTab === 'crud_sdm' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* TAMBAH SDM MANUAL */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faUserPlus} className="text-emerald-400" />
                <span>Tambah SDM Baru (Biodata Lengkap)</span>
              </h3>

              <form onSubmit={handleAddStaff} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Nama Lengkap & Gelar *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nama Lengkap Petugas"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">NIP</label>
                    <input
                      type="text"
                      placeholder="Nomor Induk Pegawai / NIP"
                      value={NIP}
                      onChange={(e) => setNIP(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Jabatan SDM PKH</label>
                    <select
                      value={jabatan}
                      onChange={(e) => setJabatan(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    >
                      {LIST_JABATAN_PKH.map((jab) => (
                        <option key={jab} value={jab}>{jab}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Status Kepegawaian</label>
                    <select
                      value={statusPegawai}
                      onChange={(e) => setStatusPegawai(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    >
                      {LIST_STATUS_PEGAWAI.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">TMT Bertugas</label>
                    <input
                      type="date"
                      value={tmt}
                      onChange={(e) => setTmt(e.target.value)}
                      className="w-full px-3 py-2 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">No. WA / HP</label>
                    <input
                      type="text"
                      placeholder="08xxxxxxxxxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Email Aktif</label>
                    <input
                      type="email"
                      placeholder="email@pkh.id"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">No. Rekening Bank</label>
                    <input
                      type="text"
                      placeholder="Nomor Rekening"
                      value={rekening}
                      onChange={(e) => setRekening(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Alamat Domisili Lengkap</label>
                  <input
                    type="text"
                    placeholder="Jl. / RT / Desa / Kecamatan"
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                {/* INPUT KECAMATAN DATALIST FLEXIBLE */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Kecamatan Tugas</label>
                  <input
                    type="text"
                    list="kecamatan-list-add"
                    value={kecamatan}
                    onChange={(e) => handleKecamatanAddChange(e.target.value)}
                    placeholder="Pilih atau Ketik Kecamatan Tugas"
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                  />
                  <datalist id="kecamatan-list-add">
                    {allKecOptions.map((kec) => (
                      <option key={kec} value={kec} />
                    ))}
                  </datalist>
                </div>

                {/* PILIHAN DESA MULTI-SELECT CHECKBOX */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Desa / Kelurahan Pendampingan
                    </label>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      {selectedDesa.length} Terpilih
                    </span>
                  </div>
                  <div className="max-h-36 overflow-y-auto p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 grid grid-cols-2 gap-1.5 custom-scrollbar">
                    {kecamatan && (wilayahData[kecamatan] || []).length > 0 ? (
                      (wilayahData[kecamatan] || []).map((des) => {
                        const isChecked = selectedDesa.includes(des);
                        return (
                          <label
                            key={des}
                            className={`flex items-center gap-2 p-2 rounded-xl text-xs cursor-pointer transition-all border ${
                              isChecked
                                ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
                                : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleDesaToggleAdd(des)}
                              className="rounded accent-emerald-500 w-3.5 h-3.5 cursor-pointer"
                            />
                            <span className="truncate">{des}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span className="col-span-full text-slate-500 italic text-xs py-2 text-center">
                        Pilih kecamatan atau tambah desa di Master Wilayah.
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-3d-button transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Simpan SDM Ke Database</span>
                </button>
              </form>
            </div>

            {/* IMPORT EXCEL SDM & TOOLBAR ACTION */}
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl shadow-3d-glass flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <FontAwesomeIcon icon={faFileExcel} className="text-cyan-400" />
                    <span>Import SDM dari Excel (.xlsx)</span>
                  </h3>
                  <button
                    onClick={downloadSdmExcelTemplate}
                    className="px-3 py-1.5 rounded-xl bg-cyan-950 border border-cyan-500/40 text-cyan-300 hover:text-white font-semibold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Download Template Format Excel"
                  >
                    <FontAwesomeIcon icon={faDownload} />
                    <span>Format Template</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Format Header Kolom File Excel:<br />
                  • <strong>Kolom 1:</strong> Nama Lengkap | <strong>Kolom 2:</strong> NIP | <strong>Kolom 3:</strong> Jabatan<br />
                  • <strong>Kolom 4:</strong> Status Pegawai | <strong>Kolom 5:</strong> TMT | <strong>Kolom 6:</strong> No HP/WA<br />
                  • <strong>Kolom 7:</strong> Email | <strong>Kolom 8:</strong> No Rekening | <strong>Kolom 9:</strong> Alamat<br />
                  • <strong>Kolom 10:</strong> Kecamatan | <strong>Kolom 11:</strong> Desa (Dipisahkan koma)
                </p>
              </div>

              <div className="space-y-2">
                <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-3d-button transition-all w-full justify-center">
                  <FontAwesomeIcon icon={faFileExcel} />
                  <span>Pilih File Excel & Import Langsung</span>
                  <input type="file" accept=".xlsx, .xls, .csv" onChange={handleExcelUpload} className="hidden" />
                </label>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={exportAllSdmToExcel}
                    className="flex-1 py-2.5 rounded-2xl bg-indigo-900/60 border border-indigo-500/40 text-indigo-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faFileExport} />
                    <span>Export All Excel</span>
                  </button>

                  <button
                    onClick={handleClearAllStaff}
                    className="py-2.5 px-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-400 hover:bg-rose-900 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    title="Hapus Total Seluruh Data SDM Tanpa Sisa"
                  >
                    <FontAwesomeIcon icon={faBroom} />
                    <span>Format Clean All SDM</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SMART FILTER BAR REALTIME DATABASE SDM TERHUBUNG PERFECTLY */}
          <div className="p-5 rounded-3xl bg-slate-900/80 border border-indigo-500/30 backdrop-blur-xl space-y-4">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs sm:text-sm">
              <FontAwesomeIcon icon={faFilter} />
              <span>Smart Filter Realtime Database SDM</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search Text */}
              <div className="relative">
                <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-3 text-slate-500 text-xs" />
                <input
                  type="text"
                  placeholder="Cari Nama / NIP / HP..."
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              {/* Jabatan Filter */}
              <select
                value={filterJabatan}
                onChange={(e) => setFilterJabatan(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              >
                <option value="">-- Semua Jabatan --</option>
                {LIST_JABATAN_PKH.map((jab) => (
                  <option key={jab} value={jab}>{jab}</option>
                ))}
              </select>

              {/* Status Pegawai Filter */}
              <select
                value={filterStatusPegawai}
                onChange={(e) => setFilterStatusPegawai(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              >
                <option value="">-- Semua Status --</option>
                {LIST_STATUS_PEGAWAI.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>

              {/* Kecamatan Filter Terhubung */}
              <select
                value={filterKecamatan}
                onChange={(e) => {
                  setFilterKecamatan(e.target.value);
                  setFilterDesa('');
                }}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
              >
                <option value="">-- Semua Kecamatan --</option>
                {allKecOptions.map((kec) => (
                  <option key={kec} value={kec}>Kec. {kec}</option>
                ))}
              </select>

              {/* Desa Filter Terhubung */}
              <select
                value={filterDesa}
                onChange={(e) => setFilterDesa(e.target.value)}
                disabled={!filterKecamatan}
                className="px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 disabled:opacity-50"
              >
                <option value="">-- Semua Desa --</option>
                {availableDesaFilter.map((des) => (
                  <option key={des} value={des}>Desa {des}</option>
                ))}
              </select>
            </div>
          </div>

          {/* DAFTAR KARTU SDM TERDAFTAR */}
          <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-3d-glass space-y-6">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Daftar SDM Terdaftar ({filteredStaffList.length} dari {cleanStaffList.length} Orang)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStaffList.length > 0 ? (
                filteredStaffList.map((staff) => {
                  const sId = staff.id;
                  const sName = staff.name || '-';
                  const sNIP = staff.NIP || staff.nip || staff.nik || staff.NIK || '-';
                  const sJabatan = staff.jabatan || 'Pendamping Sosial';
                  const sStatus = staff.statusPegawai || 'Non-ASN / Kontrak';
                  const sTmt = (staff.tmt && staff.tmt !== '') ? staff.tmt : '-';
                  const sPhone = (staff.phone && staff.phone !== '') ? staff.phone : '-';
                  const sEmail = (staff.email && staff.email !== '') ? staff.email : '-';
                  const sRekening = (staff.rekening && staff.rekening !== '') ? staff.rekening : '-';
                  const sAlamat = (staff.alamat && staff.alamat !== '') ? staff.alamat : '-';
                  
                  const sKecClean = (staff.kecamatan && staff.kecamatan !== '-') ? staff.kecamatan : '-';
                  const desaList = parseDesaArray(staff.desa);

                  return (
                    <div key={sId} className="p-4.5 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-start gap-3 hover:border-indigo-500/40 transition-all shadow-md">
                      {editingId === sId ? (
                        <div className="flex flex-col gap-2 w-full space-y-1">
                          <span className="text-xs font-bold text-amber-400 block">Edit Biodata SDM:</span>
                          
                          <div>
                            <label className="text-[10px] text-slate-300 block mb-0.5">Nama Lengkap & Gelar:</label>
                            <input
                              type="text"
                              value={editName}
                              placeholder="Nama Lengkap"
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-indigo-500 text-white text-xs outline-none"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-300 block mb-0.5">NIP:</label>
                              <input
                                type="text"
                                value={editNIP}
                                placeholder="NIP"
                                onChange={(e) => setEditNIP(e.target.value)}
                                className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px] outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-300 block mb-0.5">No. HP / WA:</label>
                              <input
                                type="text"
                                value={editPhone}
                                placeholder="No. HP / WA"
                                onChange={(e) => setEditPhone(e.target.value)}
                                className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px] outline-none"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-300 block mb-0.5">Jabatan SDM:</label>
                              <select
                                value={editJabatan}
                                onChange={(e) => setEditJabatan(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-white/20 text-white text-[11px] outline-none focus:border-indigo-500"
                              >
                                {LIST_JABATAN_PKH.map((jab) => (
                                  <option key={jab} value={jab}>{jab}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] text-slate-300 block mb-0.5">Status Kepegawaian:</label>
                              <select
                                value={editStatusPegawai}
                                onChange={(e) => setEditStatusPegawai(e.target.value)}
                                className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-white/20 text-white text-[11px] outline-none focus:border-indigo-500"
                              >
                                {LIST_STATUS_PEGAWAI.map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-slate-300 block mb-0.5">TMT Bertugas:</label>
                              <input
                                type="date"
                                value={editTmt}
                                onChange={(e) => setEditTmt(e.target.value)}
                                className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px] outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] text-slate-300 block mb-0.5">Email:</label>
                              <input
                                type="email"
                                value={editEmail}
                                placeholder="Email"
                                onChange={(e) => setEditEmail(e.target.value)}
                                className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px] outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-300 block mb-0.5">No. Rekening Bank:</label>
                            <input
                              type="text"
                              value={editRekening}
                              placeholder="No Rekening Bank"
                              onChange={(e) => setEditRekening(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px] outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-300 block mb-0.5">Alamat Domisili:</label>
                            <input
                              type="text"
                              value={editAlamat}
                              placeholder="Alamat Domisili"
                              onChange={(e) => setEditAlamat(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl bg-slate-950 border border-white/10 text-white text-[11px] outline-none"
                            />
                          </div>
                          
                          {/* EDIT KECAMATAN DATALIST FLEXIBLE */}
                          <div>
                            <label className="text-[10px] text-slate-300 font-semibold block mb-0.5">Kecamatan Tugas:</label>
                            <input
                              type="text"
                              list="kecamatan-list-edit"
                              value={editKecamatan}
                              onChange={(e) => handleKecamatanEditChange(e.target.value)}
                              placeholder="Pilih atau Ketik Kecamatan"
                              className="w-full px-2 py-1.5 rounded-xl bg-slate-950 border border-indigo-500 text-white text-[11px] outline-none focus:border-indigo-400"
                            />
                            <datalist id="kecamatan-list-edit">
                              {allKecOptions.map((kec) => (
                                <option key={kec} value={kec} />
                              ))}
                            </datalist>
                          </div>

                          {/* EDIT MULTI-DESA CHECKBOX */}
                          <div>
                            <span className="text-[10px] text-slate-300 font-semibold block mb-1">
                              Desa Pendampingan ({editDesa.length} Terpilih):
                            </span>
                            <div className="max-h-28 overflow-y-auto p-2 rounded-xl bg-slate-950 border border-white/10 grid grid-cols-2 gap-1 custom-scrollbar">
                              {editKecamatan && (wilayahData[editKecamatan] || []).length > 0 ? (
                                (wilayahData[editKecamatan] || []).map((des) => {
                                  const isChecked = editDesa.includes(des);
                                  return (
                                    <label
                                      key={des}
                                      className={`flex items-center gap-1.5 p-1 rounded-lg text-[10px] cursor-pointer border ${
                                        isChecked
                                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300 font-bold'
                                          : 'bg-white/5 border-transparent text-slate-400'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleDesaToggleEdit(des)}
                                        className="rounded accent-indigo-500 w-3 h-3 cursor-pointer"
                                      />
                                      <span className="truncate">{des}</span>
                                    </label>
                                  );
                                })
                              ) : (
                                <span className="col-span-full text-slate-500 italic text-[10px] py-1 text-center">
                                  Pilih kecamatan atau tambah desa di Master Wilayah.
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1 rounded-xl bg-white/10 text-white text-xs cursor-pointer"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleUpdateStaff(sId)}
                              className="px-4 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-3d-button"
                            >
                              Simpan Perubahan
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-1.5 truncate flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-extrabold text-white text-sm truncate">{sName}</span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-[10px]">
                                <FontAwesomeIcon icon={faBriefcase} className="mr-1" />
                                {sJabatan}
                              </span>

                              <span className="inline-block px-2 py-0.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 font-semibold text-[10px]">
                                {sStatus}
                              </span>
                            </div>

                            <div className="text-[10px] text-slate-300 space-y-0.5 pt-1">
                              <p className="flex items-center gap-1.5">
                                <FontAwesomeIcon icon={faIdCard} className="text-amber-400 w-3 shrink-0" />
                                <span>NIP: <strong>{sNIP}</strong></span>
                              </p>
                              <p className="flex items-center gap-1.5">
                                <FontAwesomeIcon icon={faPhone} className="text-emerald-400 w-3 shrink-0" />
                                <span>WA: <strong>{sPhone}</strong></span>
                              </p>
                              {sTmt !== '-' && (
                                <p className="flex items-center gap-1.5 text-slate-400">
                                  <FontAwesomeIcon icon={faCalendarAlt} className="text-cyan-400 w-3 shrink-0" />
                                  <span>TMT: {sTmt}</span>
                                </p>
                              )}
                              {sRekening !== '-' && (
                                <p className="flex items-center gap-1.5 text-slate-400">
                                  <FontAwesomeIcon icon={faCreditCard} className="text-indigo-400 w-3 shrink-0" />
                                  <span className="truncate">Rek: {sRekening}</span>
                                </p>
                              )}
                            </div>

                            <div className="text-[10px] text-indigo-300 font-semibold flex items-start gap-1 leading-snug pt-1.5 border-t border-white/10">
                              <FontAwesomeIcon icon={faMapMarkerAlt} className="text-rose-400 mt-0.5 shrink-0" />
                              <div className="break-words">
                                <span className="text-white font-bold">
                                  {sKecClean !== '-' ? `Kec. ${sKecClean}` : 'Kecamatan Belum Diatur'}
                                </span>
                                <p className="text-slate-400 font-normal">
                                  Desa: {desaList.length > 0 ? desaList.join(', ') : '-'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button 
                              onClick={() => handleStartEditStaff(staff)} 
                              className="p-2 text-indigo-400 hover:text-indigo-300 cursor-pointer text-sm"
                              title="Edit Biodata SDM"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button 
                              onClick={() => handleDeleteStaff(sId, sName)} 
                              className="p-2 text-rose-400 hover:text-rose-300 cursor-pointer text-sm"
                              title="Hapus SDM"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full text-center py-8 text-slate-400 italic text-xs border border-dashed border-white/10 rounded-2xl">
                  Database SDM kosong. Silakan tambah manual atau import file Excel.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 2: MASTER DATABASE DESA & KECAMATAN */}
      {activeSubTab === 'database_wilayah' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-xl shadow-3d-glass flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faFileExcel} className="text-amber-400" />
                <span>Import Master Wilayah dari Excel (.xlsx)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Format Kolom: <strong>Kolom 1:</strong> Nama Kecamatan | <strong>Kolom 2:</strong> Nama Desa (dipisahkan koma)
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <button
                onClick={downloadWilayahExcelTemplate}
                className="px-4 py-3 rounded-2xl bg-amber-950 border border-amber-500/40 text-amber-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer flex-1 md:flex-none"
              >
                <FontAwesomeIcon icon={faDownload} />
                <span>Format Template</span>
              </button>

              <label className="cursor-pointer inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-3d-button transition-all flex-1 md:flex-none justify-center">
                <FontAwesomeIcon icon={faUpload} />
                <span>Import Excel Wilayah</span>
                <input type="file" accept=".xlsx, .xls, .csv" onChange={handleMasterWilayahExcelUpload} className="hidden" />
              </label>

              <button
                onClick={handleClearAllWilayah}
                className="px-3 py-3 rounded-2xl bg-red-950/80 border border-red-500/50 text-red-300 hover:bg-red-900 hover:text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                title="Kosongkan Seluruh Master Wilayah"
              >
                <FontAwesomeIcon icon={faTrash} />
                <span>Kosongkan Wilayah</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faBuilding} className="text-indigo-400" />
                <span>Tambah Kecamatan Baru</span>
              </h3>

              <form onSubmit={handleAddKecamatan} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">Nama Kecamatan</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kecamatan A"
                    value={newKecName}
                    onChange={(e) => setNewKecName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-3d-button transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Simpan Kecamatan</span>
                </button>
              </form>
            </div>

            <div className="p-5 sm:p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faFolderPlus} className="text-emerald-400" />
                <span>Tambah Desa ke Kecamatan</span>
              </h3>

              <form onSubmit={handleAddDesaToKec} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Pilih Kecamatan</label>
                    <select
                      value={targetKecForDesa}
                      onChange={(e) => setTargetKecForDesa(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    >
                      {Object.keys(wilayahData).length > 0 ? (
                        Object.keys(wilayahData).map((kec) => (
                          <option key={kec} value={kec}>Kec. {kec}</option>
                        ))
                      ) : (
                        <option value="">-- Buat Kecamatan Dahulu --</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">Nama Desa / Kelurahan Baru</label>
                    <input
                      type="text"
                      required
                      placeholder="Masukkan nama desa"
                      value={newDesaName}
                      onChange={(e) => setNewDesaName(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-3d-button transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faPlus} />
                  <span>Tambah Desa</span>
                </button>
              </form>
            </div>
          </div>

          <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-3d-glass space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center justify-between">
              <span>Daftar Master Wilayah ({Object.keys(wilayahData).length} Kecamatan)</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.keys(wilayahData).length > 0 ? (
                Object.entries(wilayahData).map(([kecName, desaArr]) => (
                  <div key={kecName} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-white/10">
                      {editingKecKey === kecName ? (
                        <div className="flex items-center gap-2 flex-1">
                          <input
                            type="text"
                            value={editingKecValue}
                            onChange={(e) => setEditingKecValue(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-indigo-500 text-white text-xs outline-none"
                          />
                          <button
                            onClick={() => handleUpdateKecamatan(kecName)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                          >
                            Simpan
                          </button>
                          <button
                            onClick={() => setEditingKecKey(null)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 text-white text-xs cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="font-extrabold text-white text-sm sm:text-base flex items-center gap-2">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="text-amber-400" />
                            <span>Kecamatan {kecName}</span>
                            <span className="text-[10px] bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">
                              {desaArr.length} Desa
                            </span>
                          </span>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setEditingKecKey(kecName); setEditingKecValue(kecName); }}
                              className="p-1.5 text-indigo-400 hover:text-indigo-300 cursor-pointer text-xs"
                              title="Edit Kecamatan"
                            >
                              <FontAwesomeIcon icon={faEdit} />
                            </button>
                            <button
                              onClick={() => handleDeleteKecamatan(kecName)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 cursor-pointer text-xs"
                              title="Hapus Kecamatan"
                            >
                              <FontAwesomeIcon icon={faTrash} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                      {desaArr.length > 0 ? (
                        desaArr.map((des, idx) => (
                          <div key={idx} className="p-2 rounded-xl bg-slate-950/60 border border-white/5 flex justify-between items-center text-xs">
                            {editingDesaLocation?.kec === kecName && editingDesaLocation?.index === idx ? (
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  value={editingDesaValue}
                                  onChange={(e) => setEditingDesaValue(e.target.value)}
                                  className="w-full px-2 py-1 rounded-lg bg-slate-900 border border-emerald-500 text-white text-[11px] outline-none"
                                />
                                <button
                                  onClick={() => handleUpdateDesa(kecName, idx)}
                                  className="p-1 text-emerald-400 font-bold"
                                >
                                  <FontAwesomeIcon icon={faCheckCircle} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-slate-300 font-medium truncate">{des}</span>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingDesaLocation({ kec: kecName, index: idx });
                                      setEditingDesaValue(des);
                                    }}
                                    className="text-indigo-400 hover:text-indigo-300 p-1"
                                  >
                                    <FontAwesomeIcon icon={faEdit} className="text-[11px]" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteDesa(kecName, idx)}
                                    className="text-rose-400 hover:text-rose-300 p-1"
                                  >
                                    <FontAwesomeIcon icon={faTrash} className="text-[11px]" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="col-span-full text-slate-500 italic text-xs py-2">
                          Belum ada desa di kecamatan ini.
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-8 text-slate-400 italic text-xs border border-dashed border-white/10 rounded-2xl">
                  Master Wilayah kosong. Silakan upload file Excel Wilayah atau tambah manual.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 3: FULL CRUD HARI LIBUR / TANGGAL MERAH */}
      {activeSubTab === 'holidays' && (
        <div className="space-y-6 sm:space-y-8">
          <div className="flex justify-between items-center flex-col md:flex-row gap-4 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-rose-950/60 via-slate-900/80 to-indigo-950/60 border border-rose-500/30 backdrop-blur-xl shadow-3d-glass">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
                <FontAwesomeIcon icon={faCloudDownloadAlt} className="text-rose-400" />
                <span>Sinkronisasi Hari Libur Nasional Online</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1">
                Tarik otomatis seluruh tanggal merah & cuti bersama resmi tahun 2026.
              </p>
            </div>

            <button
              onClick={handleSyncOnlineHolidays}
              disabled={isSyncingHolidays}
              className="w-full md:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-sm shadow-3d-button flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <FontAwesomeIcon icon={isSyncingHolidays ? faSpinner : faCloudDownloadAlt} spin={isSyncingHolidays} />
              <span>{isSyncingHolidays ? 'Proses Sinkronisasi...' : 'Sinkronkan Libur Nasional (API)'}</span>
            </button>
          </div>

          <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-rose-500/30 backdrop-blur-xl shadow-3d-glass">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-6 flex items-center gap-3">
              <FontAwesomeIcon icon={faCalendarMinus} className="text-rose-400" />
              <span>Tambah Tanggal Merah / Hari Libur Manual</span>
            </h3>

            <form onSubmit={handleSaveHoliday} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Pilih Tanggal Libur</label>
                <input
                  type="date"
                  value={holidayDate}
                  onChange={(e) => setHolidayDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Keterangan Hari Libur</label>
                <input
                  type="text"
                  placeholder="Contoh: HUT RI / Cuti Bersama"
                  value={holidayTitle}
                  onChange={(e) => setHolidayTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-rose-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-3d-button transition-all cursor-pointer"
                >
                  Simpan Hari Libur
                </button>
              </div>
            </form>
          </div>

          <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-3d-glass">
            <h3 className="text-lg sm:text-xl font-bold text-white mb-6">
              Daftar Tanggal Merah Terdaftar ({holidayList.length})
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {holidayList.length > 0 ? (
                holidayList.map(([dateStr, val]) => (
                  <div key={dateStr} className="p-4 rounded-2xl bg-rose-950/30 border border-rose-500/30 flex justify-between items-center gap-3">
                    {editingHolidayDate === dateStr ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingHolidayTitle}
                          onChange={(e) => setEditingHolidayTitle(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl bg-slate-950 border border-rose-500 text-white text-xs outline-none"
                        />
                        <button
                          onClick={() => handleUpdateHolidaySubmit(dateStr)}
                          className="p-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                          title="Simpan"
                        >
                          <FontAwesomeIcon icon={faCheckCircle} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-bold text-rose-300 text-sm block">{dateStr}</span>
                          <span className="text-xs text-slate-300 font-medium">{getHolidayText(val)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditHolidayClick(dateStr, val)}
                            className="p-2 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            title="Edit Keterangan"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleDeleteHoliday(dateStr)}
                            className="p-2 text-rose-400 hover:text-rose-300 cursor-pointer"
                            title="Hapus Tanggal Merah"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-6 text-slate-400 italic text-sm">
                  Belum ada tanggal merah terdaftar. Klik **Sinkronkan Libur Nasional (API)** atau tambah manual di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB TAB 4: CONFIG SYSTEM & TTD */}
      {activeSubTab === 'pengaturan' && (
        <div className="space-y-8">
          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-purple-500/30 backdrop-blur-xl shadow-3d-glass space-y-5">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 flex items-center gap-3">
                <FontAwesomeIcon icon={faSlidersH} className="text-purple-400" />
                <span>Aturan Logika Acak Piket</span>
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Batas Minimum Hari Kerja Aktif untuk Piket 2x (Default: 13 Hari)
                </label>
                <input
                  type="number"
                  value={minWorkdaysForDoublePiket}
                  onChange={(e) => setMinWorkdaysForDoublePiket(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * Jika hari kerja aktif &gt; nilai ini, SDM piket 2x sebulan. Jika &le; nilai ini, SDM piket 1x sebulan.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">Kuota Hari Senin (0 = Otomatis)</label>
                  <input
                    type="number"
                    placeholder="0 = Auto"
                    value={piketSeninQuota}
                    onChange={(e) => setPiketSeninQuota(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">* Selalu otomatis diset lebih banyak dari hari biasa.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-2">Kuota Selasa - Jumat (0 = Otomatis)</label>
                  <input
                    type="number"
                    placeholder="0 = Auto"
                    value={piketHarianQuota}
                    onChange={(e) => setPiketHarianQuota(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-purple-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">* Minimal 2 orang per hari kerja.</p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass space-y-5">
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2 flex items-center gap-3">
                <FontAwesomeIcon icon={faSignature} className="text-indigo-400" />
                <span>Pengaturan Penandatangan Export PDF</span>
              </h3>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Jabatan Penandatangan</label>
                <input
                  type="text"
                  placeholder="Masukkan Jabatan Penandatangan"
                  value={signerTitle}
                  onChange={(e) => setSignerTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Nama Lengkap Penandatangan</label>
                <input
                  type="text"
                  placeholder="Masukkan Nama Lengkap Penandatangan"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Unggah TTD Digital (PNG Transparan)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="w-full text-xs text-slate-300 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:bg-indigo-600 file:text-white file:font-bold hover:file:bg-indigo-500 cursor-pointer"
                />
                {signatureImg && (
                  <div className="mt-3 p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                    <img src={signatureImg} alt="Preview TTD" className="h-12 object-contain bg-white/10 rounded-lg p-1" />
                    <span className="text-xs text-emerald-300 font-semibold">TTD Digital Terpasang</span>
                  </div>
                )}
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-3d-button transition-all cursor-pointer"
                >
                  <FontAwesomeIcon icon={faSave} className="mr-2" />
                  <span>Simpan Semua Pengaturan Admin</span>
                </button>
              </div>
            </div>
          </form>

          <div className="p-5 sm:p-8 rounded-3xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-xl shadow-3d-glass space-y-6">
            <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-3">
              <FontAwesomeIcon icon={faListCheck} className="text-amber-400" />
              <span>Kelola Catatan & Petunjuk Tugas Piket</span>
            </h3>

            <form onSubmit={handleAddNote} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="Tambah Poin Catatan Tugas Piket Baru..."
                value={newNoteInput}
                onChange={(e) => setNewNoteInput(e.target.value)}
                className="flex-1 px-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-sm outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-3d-button flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Tambah Catatan</span>
              </button>
            </form>

            <div className="space-y-3">
              {piketNotes.length > 0 ? (
                piketNotes.map((note, index) => (
                  <div key={index} className="p-4 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center gap-3">
                    {editingNoteIndex === index ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-amber-500 text-white text-xs outline-none"
                        />
                        <button
                          onClick={() => handleUpdateNote(index)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                        >
                          Simpan
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {index + 1}
                          </span>
                          <span className="text-sm text-slate-200">{note}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingNoteIndex(index); setEditingNoteText(note); }}
                            className="p-2 text-indigo-400 hover:text-indigo-300 cursor-pointer"
                            title="Edit Catatan"
                          >
                            <FontAwesomeIcon icon={faEdit} />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(index)}
                            className="p-2 text-rose-400 hover:text-rose-300 cursor-pointer"
                            title="Hapus Catatan"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-slate-400 italic text-xs border border-dashed border-white/10 rounded-2xl">
                  Belum ada catatan tugas piket terdaftar. Tambahkan poin catatan baru di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}