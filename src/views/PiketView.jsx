import React, { useState, useEffect, useMemo } from 'react';
import { db, ref, set, push, remove, onValue, update } from '../firebase';
import { useToast } from '../context/ToastContext';
import { exportPiketToPDF } from '../utils/pdfExporter';
import { generateMonthlySchedule } from '../utils/piketGenerator';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSync, 
  faFilePdf, 
  faExchangeAlt, 
  faTimes, 
  faCalendarAlt, 
  faClock,
  faHourglassHalf,
  faUserCheck,
  faLock,
  faUnlock,
  faTrashAlt,
  faHistory,
  faSearch,
  faUser,
  faFilter,
  faCalendarCheck,
  faPlus,
  faClipboardCheck, 
  faCheck,          
  faTimesCircle,
  faMoneyBillWave, 
  faCommentDots,
  faSignInAlt,    
  faSignOutAlt,
  faEyeSlash,     // TAMBAHAN UNTUK SEMBUNYIKAN NAMA
  faUndo          // TAMBAHAN UNTUK KEMBALIKAN NAMA
} from '@fortawesome/free-solid-svg-icons';

export default function PiketView({ schedules = {}, staffList = [], config = {}, holidays = {}, isAdmin, isSdm }) {
  const { showToast } = useToast();
  const now = new Date();

  // PENENTUAN MODE PUBLIK (Hanya bisa melihat)
  const isPublic = !isAdmin && !isSdm;

  // ---------------------------------------------------------------------------
  // 1. STATE FILTER KALENDER & DYNAMIC MONTH KEY
  // ---------------------------------------------------------------------------
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1); // 1 - 12
  const [viewYear, setViewYear] = useState(now.getFullYear());

  const namaBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const currentMonthKey = `${viewYear}-${String(viewMonth).padStart(2, '0')}`;
  const currentSchedule = schedules[currentMonthKey] || {};
  const isScheduleLocked = !!currentSchedule.isLocked;

  // Tanggal Hari Ini untuk penanda (Format: YYYY-MM-DD)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ---------------------------------------------------------------------------
  // 2. STATE SUB-MENU FILTER JADWAL SDM
  // ---------------------------------------------------------------------------
  const [sdmFilterSubMenuOpen, setSdmFilterSubMenuOpen] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState('');

  const getStaffName = (id) => {
    if (!id) return '-';
    const found = staffList.find((s) => s.id === id || s.key === id);
    if (found) {
      return found.name || found.NAMA || found.nama || found.id;
    }
    return id;
  };

  // ---------------------------------------------------------------------------
  // 3. STATE MODAL GENERATE PIKET & SUB-MENU LOG TUKAR
  // ---------------------------------------------------------------------------
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genMonth, setGenMonth] = useState(() => (now.getMonth() === 11 ? 1 : now.getMonth() + 2));
  const [genYear, setGenYear] = useState(() => (now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear()));

  const [logsSubMenuOpen, setLogsSubMenuOpen] = useState(false);
  const [swapLogs, setSwapLogs] = useState([]);

  // ---------------------------------------------------------------------------
  // 4. STATE MODAL TUKAR & REALTIME TIMER & TAMBAH PETUGAS (ADMIN)
  // ---------------------------------------------------------------------------
  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState(null);

  const [selectedStaffA, setSelectedStaffA] = useState('');
  const [selectedDateA, setSelectedDateA] = useState('');
  const [selectedDateB, setSelectedDateB] = useState('');
  const [selectedStaffB, setSelectedStaffB] = useState('');

  const [pendingRequests, setPendingRequests] = useState([]);
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [selectedDateToAdd, setSelectedDateToAdd] = useState('');
  const [selectedStaffToAdd, setSelectedStaffToAdd] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const pendingRef = ref(db, 'swapRequests');
    const unsubscribe = onValue(pendingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

        list.forEach((req) => {
          if (Date.now() - req.timestamp >= EIGHT_HOURS_MS) {
            remove(ref(db, `swapRequests/${req.id}`)).catch(() => {});
          }
        });

        setPendingRequests(list.filter((req) => Date.now() - req.timestamp < EIGHT_HOURS_MS));
      } else {
        setPendingRequests([]);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const logsRef = ref(db, 'swaps');
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]) => ({ id, ...val }))
          .filter((log) => log.monthKey === currentMonthKey || !log.monthKey);
        setSwapLogs(list);
      } else {
        setSwapLogs([]);
      }
    });

    return () => unsubscribe();
  }, [currentMonthKey]);

  // ---------------------------------------------------------------------------
  // 5. HANDLER GENERATE, KUNCI, & RESET JADWAL (ADMIN)
  // ---------------------------------------------------------------------------
  const handleGeneratePiket = () => {
    if (!isAdmin) return showToast('Akses terkunci. Silakan masuk sebagai Admin!', 'error');
    if (isScheduleLocked) return showToast('Jadwal bulan ini DIKUNCI. Buka kunci terlebih dahulu!', 'error');
    if (!staffList || staffList.length < 5) return showToast('Jumlah SDM minimal 5 orang!', 'error');

    try {
      const newSchedule = generateMonthlySchedule(genYear, genMonth, staffList, config, holidays);
      const targetKey = `${genYear}-${String(genMonth).padStart(2, '0')}`;

      set(ref(db, `schedules/${targetKey}`), {
        ...newSchedule,
        isLocked: false
      });

      setViewMonth(genMonth);
      setViewYear(genYear);
      setGenModalOpen(false);

      showToast(`Jadwal piket ${namaBulan[genMonth - 1]} ${genYear} berhasil diacak!`, 'success');
    } catch (err) {
      console.error("Gagal generate piket:", err);
      showToast('Terjadi kesalahan saat mengacak jadwal.', 'error');
    }
  };

  const handleToggleLockSchedule = () => {
    if (!isAdmin) return showToast('Hanya Admin yang dapat mengunci jadwal!', 'error');
    const newLockStatus = !isScheduleLocked;

    update(ref(db, `schedules/${currentMonthKey}`), { isLocked: newLockStatus });
    showToast(newLockStatus ? 'Jadwal resmi DIKUNCI!' : 'Kunci jadwal DIBUKA.', 'info');
  };

  const handleResetMonthlySchedule = async () => {
    if (!isAdmin) return showToast('Akses terkunci. Khusus Admin!', 'error');
    if (isScheduleLocked) return showToast('Jadwal bulan ini DIKUNCI. Buka kunci terlebih dahulu!', 'error');

    if (window.confirm(`PERHATIAN! Apakah Anda yakin ingin MERESET/MENGHAPUS SELURUH JADWAL PIKET bulan ${namaBulan[viewMonth - 1]} ${viewYear}?`)) {
      try {
        await remove(ref(db, `schedules/${currentMonthKey}`));
        showToast(`Jadwal piket bulan ${namaBulan[viewMonth - 1]} ${viewYear} berhasil di-reset!`, 'info');
      } catch (err) {
        showToast('Gagal mereset jadwal piket.', 'error');
      }
    }
  };

  const handleExportPDF = () => {
    if (Object.keys(currentSchedule).filter(k => k !== 'isLocked').length === 0) {
      return showToast(`Belum ada jadwal piket ${namaBulan[viewMonth - 1]} ${viewYear} untuk dicetak!`, 'error');
    }
    exportPiketToPDF(namaBulan[viewMonth - 1], String(viewYear), currentSchedule, staffList, config);
    showToast('Mengunduh PDF Laporan Resmi...', 'info');
  };

  const handleCardClick = (dateStr, staffId) => {
    if (isPublic) {
      showToast('Akses Publik: Anda hanya dapat melihat jadwal piket.', 'info');
      return;
    }

    const existingReq = pendingRequests.find(
      (r) => (r.staffA === staffId && r.dateA === dateStr) || (r.staffB === staffId && r.dateB === dateStr)
    );

    if (existingReq) {
      setActiveRequest(existingReq);
      setConfirmModalOpen(true);
    } else {
      setSelectedDateA(dateStr);
      setSelectedStaffA(staffId);
      setSelectedDateB('');
      setSelectedStaffB('');
      setSwapModalOpen(true);
    }
  };

  const handleRemoveStaffFromDate = async () => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (!selectedDateA || !selectedStaffA) return;

    const dayNum = new Date(selectedDateA).getDate();

    if (window.confirm(`Hapus ${getStaffName(selectedStaffA)} dari piket tanggal ${dayNum}?`)) {
      try {
        const scheduleA = currentSchedule[selectedDateA] || {};
        const assignedA = Array.isArray(scheduleA.assigned) ? scheduleA.assigned : [];
        const newAssignedA = assignedA.filter((id) => id !== selectedStaffA);

        const swappedInfoA = { ...(scheduleA.swappedInfo || {}) };
        delete swappedInfoA[selectedStaffA];

        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/assigned`), newAssignedA);
        
        if (Object.keys(swappedInfoA).length === 0) {
          await remove(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/swappedInfo`));
        } else {
          await set(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/swappedInfo`), swappedInfoA);
        }

        showToast(`Petugas ${getStaffName(selectedStaffA)} berhasil dihapus dari tanggal ${dayNum}!`, 'success');
        setSwapModalOpen(false);
      } catch (err) {
        showToast('Gagal menghapus petugas piket.', 'error');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 6. HANDLER TUKAR PIKET
  // ---------------------------------------------------------------------------
  const handleCreateSwapRequest = async (e) => {
    e.preventDefault();
    if (!selectedDateB || !selectedStaffB) return showToast('Pilih tanggal & petugas pasangan tukar!', 'error');
    if (selectedDateA === selectedDateB && selectedStaffA === selectedStaffB) return showToast('Tidak bisa menukar petugas yang sama!', 'error');
    if (selectedDateA === selectedDateB) return showToast('Harap pilih tanggal yang berbeda untuk menukar!', 'error');

    const dayNumA = new Date(selectedDateA).getDate();
    const dayNumB = new Date(selectedDateB).getDate();

    if (isAdmin) {
      try {
        const scheduleA = currentSchedule[selectedDateA] || {};
        const scheduleB = currentSchedule[selectedDateB] || {};

        const assignedA = Array.isArray(scheduleA.assigned) ? scheduleA.assigned : [];
        const assignedB = Array.isArray(scheduleB.assigned) ? scheduleB.assigned : [];

        const newAssignedA = assignedA.map((id) => (id === selectedStaffA ? selectedStaffB : id));
        const newAssignedB = assignedB.map((id) => (id === selectedStaffB ? selectedStaffA : id));

        const swappedInfoA = { ...(scheduleA.swappedInfo || {}) };
        delete swappedInfoA[selectedStaffA];
        delete swappedInfoA[selectedStaffB];

        const swappedInfoB = { ...(scheduleB.swappedInfo || {}) };
        delete swappedInfoB[selectedStaffA];
        delete swappedInfoB[selectedStaffB];

        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/assigned`), newAssignedA);
        if (Object.keys(swappedInfoA).length === 0) {
           await remove(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/swappedInfo`));
        } else {
           await set(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/swappedInfo`), swappedInfoA);
        }

        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateB}/assigned`), newAssignedB);
        if (Object.keys(swappedInfoB).length === 0) {
           await remove(ref(db, `schedules/${currentMonthKey}/${selectedDateB}/swappedInfo`));
        } else {
           await set(ref(db, `schedules/${currentMonthKey}/${selectedDateB}/swappedInfo`), swappedInfoB);
        }

        showToast('Admin berhasil menukar jadwal secara langsung (Tanpa Tanda)!', 'success');
        setSwapModalOpen(false);
        return;
      } catch (err) {
        return showToast('Gagal memproses pertukaran jadwal oleh Admin.', 'error');
      }
    }

    try {
      const newReqRef = push(ref(db, 'swapRequests'));
      await set(newReqRef, {
        dateA: selectedDateA,
        staffA: selectedStaffA,
        dayNumberA: dayNumA,
        dateB: selectedDateB,
        staffB: selectedStaffB,
        dayNumberB: dayNumB,
        approvedA: false,
        approvedB: false,
        timestamp: Date.now()
      });

      showToast(`Usulan tukar diajukan! Batas waktu konfirmasi 8 jam dimulai.`, 'success');
      setSwapModalOpen(false);
    } catch (err) {
      showToast('Akses Firebase ditolak.', 'error');
    }
  };

  const handleToggleApprove = async (party) => {
    if (!activeRequest) return;
    const updates = {};
    if (party === 'A') updates.approvedA = !activeRequest.approvedA;
    if (party === 'B') updates.approvedB = !activeRequest.approvedB;

    const updatedReq = { ...activeRequest, ...updates };

    try {
      await update(ref(db, `swapRequests/${activeRequest.id}`), updates);
      setActiveRequest(updatedReq);

      if (updatedReq.approvedA && updatedReq.approvedB) {
        const scheduleA = currentSchedule[updatedReq.dateA] || {};
        const scheduleB = currentSchedule[updatedReq.dateB] || {};

        const assignedA = Array.isArray(scheduleA.assigned) ? scheduleA.assigned : [];
        const assignedB = Array.isArray(scheduleB.assigned) ? scheduleB.assigned : [];

        const newAssignedA = assignedA.map((id) => (id === updatedReq.staffA ? updatedReq.staffB : id));
        const newAssignedB = assignedB.map((id) => (id === updatedReq.staffB ? updatedReq.staffA : id));

        const swappedInfoA = {
          ...(scheduleA.swappedInfo || {}),
          [updatedReq.staffB]: { original: updatedReq.staffA, originalDateNum: updatedReq.dayNumberA, swappedDateNum: updatedReq.dayNumberB }
        };
        const swappedInfoB = {
          ...(scheduleB.swappedInfo || {}),
          [updatedReq.staffA]: { original: updatedReq.staffB, originalDateNum: updatedReq.dayNumberB, swappedDateNum: updatedReq.dayNumberA }
        };

        await set(ref(db, `schedules/${currentMonthKey}/${updatedReq.dateA}/assigned`), newAssignedA);
        await set(ref(db, `schedules/${currentMonthKey}/${updatedReq.dateA}/swappedInfo`), swappedInfoA);

        await set(ref(db, `schedules/${currentMonthKey}/${updatedReq.dateB}/assigned`), newAssignedB);
        await set(ref(db, `schedules/${currentMonthKey}/${updatedReq.dateB}/swappedInfo`), swappedInfoB);

        await push(ref(db, 'swaps'), {
          staffA: updatedReq.staffA,
          dateA: updatedReq.dateA,
          dayNumberA: updatedReq.dayNumberA,
          staffB: updatedReq.staffB,
          dateB: updatedReq.dateB,
          dayNumberB: updatedReq.dayNumberB,
          monthKey: currentMonthKey,
          timestamp: Date.now()
        });

        await remove(ref(db, `swapRequests/${updatedReq.id}`));
        setConfirmModalOpen(false);
        showToast('Keduanya setuju! Jadwal resmi bertukar.', 'success');
      } else {
        showToast('Persetujuan dicatat. Menunggu pasangan tukar...', 'info');
      }
    } catch (err) {
      showToast('Gagal memproses persetujuan.', 'error');
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!isAdmin) return showToast('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('Hapus riwayat log tukar ini dari sistem?')) {
      await remove(ref(db, `swaps/${logId}`));
      showToast('Log tukar berhasil dihapus!', 'info');
    }
  };

  const handleClearAllLogs = async () => {
    if (!isAdmin) return showToast('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('PERHATIAN! Apakah Anda yakin ingin MENGHAPUS SELURUH LOG TUKAR?')) {
      await remove(ref(db, 'swaps'));
      showToast('Seluruh log tukar berhasil dibersihkan!', 'info');
    }
  };

  const renderCountdown = (startTimestamp) => {
    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    const elapsed = nowTimestamp - startTimestamp;
    const remaining = Math.max(0, EIGHT_HOURS_MS - elapsed);
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleOpenAddModal = (dateStr) => {
    setSelectedDateToAdd(dateStr);
    setSelectedStaffToAdd('');
    setAddModalOpen(true);
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast('Akses ditolak! Khusus Admin.', 'error');
    if (!selectedDateToAdd || !selectedStaffToAdd) return showToast('Pilih petugas yang akan ditambahkan!', 'error');

    const scheduleData = currentSchedule[selectedDateToAdd] || {};
    const assigned = Array.isArray(scheduleData.assigned) ? scheduleData.assigned : [];

    if (assigned.includes(selectedStaffToAdd)) {
      return showToast('Petugas tersebut sudah piket di tanggal ini!', 'error');
    }

    const workingDays = Object.entries(currentSchedule)
      .filter(([key, val]) => key !== 'isLocked' && val && typeof val === 'object' && !val.isHoliday)
      .map(([key, val]) => ({ dateStr: key, ...val }));
    
    let staffCounts = {};
    workingDays.forEach(day => {
      const dayAssigned = Array.isArray(day.assigned) ? day.assigned : [];
      dayAssigned.forEach(id => { staffCounts[id] = (staffCounts[id] || 0) + 1; });
    });

    const activeStaffCount = staffList.length || 1;
    const staffPerDay = config?.staffPerDay ? parseInt(config.staffPerDay, 10) : 2;
    const expectedTotalSlots = workingDays.length * staffPerDay;
    const avgPerPerson = Math.ceil(expectedTotalSlots / activeStaffCount) || staffPerDay; 
    const currentCount = staffCounts[selectedStaffToAdd] || 0;

    if (currentCount >= avgPerPerson) {
      showToast(`TIDAK BISA DISIMPAN! Jatah piket ${getStaffName(selectedStaffToAdd)} sudah penuh (Batas: ${avgPerPerson} kali bulan ini). Semua harus terbagi rata!`, 'error');
      return;
    }

    let isTooClose = false;
    const addDateObj = new Date(selectedDateToAdd);
    workingDays.forEach(day => {
      if ((day.assigned || []).includes(selectedStaffToAdd)) {
        const dayObj = new Date(day.dateStr);
        const diffDays = Math.abs(addDateObj - dayObj) / (1000 * 60 * 60 * 24);
        if (diffDays <= 2) { isTooClose = true; }
      }
    });

    if (isTooClose) {
      if (!window.confirm(`PERINGATAN LOGIKA:\n\nJarak hari piket ${getStaffName(selectedStaffToAdd)} terlalu dekat (≤ 2 Hari) dengan jadwal dia yang lain!\n\nKarena jatahnya belum penuh (${currentCount}/${avgPerPerson}), Anda tetap BISA MENYIMPANNYA secara paksa.\nTetap lanjutkan simpan?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Konfirmasi:\nTambahkan ${getStaffName(selectedStaffToAdd)} ke tanggal ${new Date(selectedDateToAdd).getDate()}?\n(Saat ini dia sudah bertugas ${currentCount} kali, batas bulan ini: ${avgPerPerson} kali).`)) {
          return;
      }
    }

    try {
      const newAssigned = [...assigned, selectedStaffToAdd];
      await set(ref(db, `schedules/${currentMonthKey}/${selectedDateToAdd}/assigned`), newAssigned);
      showToast(`Berhasil menambahkan ${getStaffName(selectedStaffToAdd)} ke tanggal ${new Date(selectedDateToAdd).getDate()}!`, 'success');
      setAddModalOpen(false);
    } catch (err) {
      showToast('Gagal menambahkan petugas ke database', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // 6.7. BAGIAN BARU: STATE, EFFECT, & HANDLER ABSEN PIKET, HITUNGAN & TABEL
  // ---------------------------------------------------------------------------
  const [absenSubMenuOpen, setAbsenSubMenuOpen] = useState(false);
  const [attendanceData, setAttendanceData] = useState({});
  const [absenSelectedDate, setAbsenSelectedDate] = useState(todayStr);
  
  // State Baru untuk Filter Evaluasi Tahunan & CRUD Hidden Staf (Admin)
  const [rekapMode, setRekapMode] = useState('Bulanan'); // 'Bulanan' | 'Tahunan'
  const [rekapYearFilter, setRekapYearFilter] = useState(now.getFullYear());
  const [allAttendanceData, setAllAttendanceData] = useState({});
  const [hiddenStaff, setHiddenStaff] = useState([]);

  // Modal Form Khusus Absen per Orang (Hadir, Izin, Alpa + Keterangan & Jam Datang/Pulang)
  const [showAbsenFormModal, setShowAbsenFormModal] = useState(false);
  const [absenFormData, setAbsenFormData] = useState({ 
    dateStr: '', staffId: '', status: 'Hadir', keterangan: '', 
    waktuDatang: '', waktuPulang: '', jamKerja: 0 
  });

  // Fetch Attendance Bulanan
  useEffect(() => {
    const attRef = ref(db, `attendance/${currentMonthKey}`);
    const unsubscribe = onValue(attRef, (snapshot) => {
      setAttendanceData(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, [currentMonthKey]);

  // Fetch Hidden Staff & All Attendance Tahunan (Khusus Admin)
  useEffect(() => {
    if (isAdmin) {
      const hsRef = ref(db, 'config/hiddenStaffRekap');
      const unsubHs = onValue(hsRef, snap => setHiddenStaff(snap.val() || []));
      return () => unsubHs();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && absenSubMenuOpen && rekapMode === 'Tahunan') {
       const attRef = ref(db, 'attendance');
       const unsubAtt = onValue(attRef, snap => setAllAttendanceData(snap.val() || {}));
       return () => unsubAtt();
    }
  }, [isAdmin, absenSubMenuOpen, rekapMode]);

  // Handler Sembunyikan Staf (CRUD)
  const handleHideStaff = async (staffId) => {
    if (!isAdmin) return;
    if (window.confirm(`Sembunyikan ${getStaffName(staffId)} dari Tabel Rekap?`)) {
       const newHidden = [...hiddenStaff, staffId];
       await set(ref(db, 'config/hiddenStaffRekap'), newHidden);
       showToast('Staf berhasil disembunyikan dari rekap.', 'success');
    }
  };

  // Handler Kembalikan Staf (CRUD)
  const handleRestoreStaff = async (staffId) => {
    if (!isAdmin) return;
    const newHidden = hiddenStaff.filter(id => id !== staffId);
    await set(ref(db, 'config/hiddenStaffRekap'), newHidden);
    showToast('Staf dikembalikan ke dalam rekap.', 'success');
  };

  const isDateAllowed = (targetDateStr) => {
    if (isAdmin) return true;
    return targetDateStr === todayStr;
  };

  // FUNGSI KALKULATOR JAM OTOMATIS
  const calculateHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh + em/60) - (sh + sm/60);
    if (diff < 0) diff += 24; 
    return parseFloat(diff.toFixed(2));
  };

  const handleAutoTime = (field) => {
    const nowLocal = new Date();
    const hhmm = `${String(nowLocal.getHours()).padStart(2, '0')}:${String(nowLocal.getMinutes()).padStart(2, '0')}`;
    setAbsenFormData(prev => {
      const newData = { ...prev, [field]: hhmm };
      if (newData.waktuDatang && newData.waktuPulang) {
        newData.jamKerja = calculateHours(newData.waktuDatang, newData.waktuPulang);
      }
      return newData;
    });
  };

  const handleTimeChange = (field, val) => {
    setAbsenFormData(prev => {
      const newData = { ...prev, [field]: val };
      if (newData.waktuDatang && newData.waktuPulang) {
        newData.jamKerja = calculateHours(newData.waktuDatang, newData.waktuPulang);
      }
      return newData;
    });
  };

  const handleOpenAbsenModal = (dateStr, staffId, defaultStatus = 'Hadir') => {
    if (isPublic) return showToast('Mode Publik tidak bisa mengisi absen.', 'error');
    if (!isDateAllowed(dateStr)) {
       return showToast('User hanya diizinkan mengisi absen pada Hari Ini (H)!', 'error');
    }
    const existingAtt = attendanceData[dateStr]?.[staffId] || {};
    setAbsenFormData({
      dateStr,
      staffId,
      status: existingAtt.status || defaultStatus,
      keterangan: existingAtt.keterangan || '',
      waktuDatang: existingAtt.waktuDatang || '',
      waktuPulang: existingAtt.waktuPulang || '',
      jamKerja: existingAtt.jamKerja !== undefined ? existingAtt.jamKerja : 0
    });
    setShowAbsenFormModal(true);
  };

  const handleSubmitAbsen = async (e) => {
    e.preventDefault();
    if (isPublic) return;

    try {
      await set(ref(db, `attendance/${currentMonthKey}/${absenFormData.dateStr}/${absenFormData.staffId}`), {
        status: absenFormData.status,
        keterangan: (absenFormData.status !== 'Hadir' && absenFormData.status !== 'Alpa') ? absenFormData.keterangan : '',
        jamKerja: absenFormData.status === 'Hadir' ? Number(absenFormData.jamKerja) : 0,
        waktuDatang: absenFormData.status === 'Hadir' ? absenFormData.waktuDatang : '',
        waktuPulang: absenFormData.status === 'Hadir' ? absenFormData.waktuPulang : '',
        timestamp: Date.now(),
        markedBy: isAdmin ? 'Admin' : 'Petugas'
      });
      showToast(`Absen ${absenFormData.status} untuk ${getStaffName(absenFormData.staffId)} berhasil dicatat!`, 'success');
      setShowAbsenFormModal(false);
    } catch (err) {
      showToast('Gagal mencatat absen.', 'error');
    }
  };

  const handleDeleteAbsen = async () => {
    if (!isAdmin) return;
    if (window.confirm(`Yakin ingin menghapus seluruh data absen ${getStaffName(absenFormData.staffId)} di tanggal ini?`)) {
      try {
        await remove(ref(db, `attendance/${currentMonthKey}/${absenFormData.dateStr}/${absenFormData.staffId}`));
        showToast('Data absen berhasil dihapus secara permanen.', 'info');
        setShowAbsenFormModal(false);
      } catch (err) {
        showToast('Gagal menghapus data absen.', 'error');
      }
    }
  };

  // Memoized: Hitungan & Riwayat Absen Dibuat Jadi Array untuk Kebutuhan Tabel (BULANAN)
  const absenStatsArray = useMemo(() => {
    const statsMap = {};
    staffList.forEach(s => {
      const sId = s.id || s.key;
      statsMap[sId] = {
        id: sId,
        name: s.name || s.NAMA || s.nama || s.id,
        totalJatah: 0, totalHadir: 0, totalIzin: 0, totalAlpa: 0,
        totalKurangJam: 0, dendaJam: 0, dendaAlpa: 0, totalDenda: 0
      };
    });

    Object.entries(currentSchedule).forEach(([dateStr, dayData]) => {
      if (dateStr === 'isLocked' || !dayData.assigned) return;
      const dayAtt = attendanceData[dateStr] || {};
      
      dayData.assigned.forEach(staffId => {
        if (!statsMap[staffId]) return;
        statsMap[staffId].totalJatah += 1;
        
        const attRecord = dayAtt[staffId];
        if (attRecord) {
          if (attRecord.status === 'Hadir') {
             statsMap[staffId].totalHadir += 1;
             const jk = Number(attRecord.jamKerja) || 0;
             if (jk < 4) {
               const kurang = 4 - jk;
               statsMap[staffId].totalKurangJam += kurang;
               statsMap[staffId].dendaJam += (kurang * 10000);
             }
          } else if (attRecord.status === 'Alpa') {
             statsMap[staffId].totalAlpa += 1;
             statsMap[staffId].dendaAlpa += 50000;
          } else {
             statsMap[staffId].totalIzin += 1;
          }
        }
      });
    });

    // Kalkulasi Total Denda Keseluruhan per Orang & Filter Hidden Staff
    return Object.values(statsMap)
      .filter(stat => !hiddenStaff.includes(stat.id))
      .map(stat => ({
        ...stat,
        totalDenda: stat.dendaJam + stat.dendaAlpa
      })).sort((a, b) => a.name.localeCompare(b.name));

  }, [currentSchedule, attendanceData, staffList, hiddenStaff]);

  // Memoized Baru: Hitungan & Riwayat TAHUNAN (Admin Only)
  const yearlyStatsArray = useMemo(() => {
    if (rekapMode !== 'Tahunan') return [];
    
    const statsMap = {};
    staffList.forEach(s => {
      const sId = s.id || s.key;
      statsMap[sId] = {
        id: sId,
        name: s.name || s.NAMA || s.nama || s.id,
        totalJatah: 0, totalHadir: 0, totalIzin: 0, totalAlpa: 0,
        totalKurangJam: 0, dendaJam: 0, dendaAlpa: 0, totalDenda: 0
      };
    });

    const yearStr = String(rekapYearFilter);

    // Iterasi seluruh jadwal bulan yang ada di prop `schedules` untuk tahun terpilih
    Object.entries(schedules).forEach(([monthKey, monthData]) => {
       if (monthKey.startsWith(yearStr)) {
          Object.entries(monthData).forEach(([dateStr, dayData]) => {
             if (dateStr === 'isLocked' || !dayData.assigned) return;
             const dayAtt = allAttendanceData[monthKey]?.[dateStr] || {};
             
             dayData.assigned.forEach(staffId => {
                if (!statsMap[staffId]) return;
                statsMap[staffId].totalJatah += 1;
                
                const attRecord = dayAtt[staffId];
                if (attRecord) {
                   if (attRecord.status === 'Hadir') {
                      statsMap[staffId].totalHadir += 1;
                      const jk = Number(attRecord.jamKerja) || 0;
                      if (jk < 4) {
                        const kurang = 4 - jk;
                        statsMap[staffId].totalKurangJam += kurang;
                        statsMap[staffId].dendaJam += (kurang * 10000);
                      }
                   } else if (attRecord.status === 'Alpa') {
                      statsMap[staffId].totalAlpa += 1;
                      statsMap[staffId].dendaAlpa += 50000;
                   } else {
                      statsMap[staffId].totalIzin += 1;
                   }
                }
             });
          });
       }
    });

    return Object.values(statsMap)
      .filter(stat => !hiddenStaff.includes(stat.id))
      .map(stat => ({
        ...stat,
        totalDenda: stat.dendaJam + stat.dendaAlpa
      })).sort((a, b) => a.name.localeCompare(b.name));

  }, [rekapMode, rekapYearFilter, schedules, allAttendanceData, staffList, hiddenStaff]);

  // Helper untuk mendapatkan array tabel aktif
  const displayedStatsArray = rekapMode === 'Tahunan' ? yearlyStatsArray : absenStatsArray;

  // ---------------------------------------------------------------------------
  // 7. STRUKTURISASI MINGGU & RANGKUMAN FILTER SDM
  // ---------------------------------------------------------------------------
  const weekDaysHeader = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
  const sortedDates = Object.entries(currentSchedule)
    .filter(([key]) => key !== 'isLocked')
    .sort(([a], [b]) => a.localeCompare(b));

  const weeksMap = {};
  let dynamicWeek = 1;

  sortedDates.forEach(([dateStr, item], idx) => {
    const dateObj = new Date(dateStr);
    const dayOfWeek = item.dayOfWeek || dateObj.getDay();

    if (idx > 0 && dayOfWeek === 1) dynamicWeek++;

    const wIdx = item.weekIndex || dynamicWeek;
    if (!weeksMap[wIdx]) weeksMap[wIdx] = {};
    weeksMap[wIdx][item.dayName] = { dateStr, ...item };
  });

  const selectedStaffScheduleSummary = useMemo(() => {
    if (!filterStaffId) return [];
    const summaryList = [];
    sortedDates.forEach(([dateStr, item]) => {
      const assignedArr = Array.isArray(item.assigned) ? item.assigned : [];
      if (assignedArr.includes(filterStaffId)) {
        const partners = assignedArr
          .filter((id) => id !== filterStaffId)
          .map((id) => getStaffName(id));

        summaryList.push({
          dateStr,
          dayNumber: item.dayNumber,
          dayName: item.dayName,
          formattedLabel: item.formattedLabel,
          weekIndex: item.weekIndex,
          partners
        });
      }
    });
    return summaryList;
  }, [filterStaffId, sortedDates, staffList]);

  return (
    <div className="space-y-5 animate-fadeIn max-w-full relative">
      {/* HEADER BAR & CONTROL PANEL MOBILE-FIRST PRESISI */}
      <div className="flex justify-between items-center flex-wrap gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-2xl font-black text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-indigo-400 text-sm sm:text-xl" />
            <span>Jadwal Piket Bulanan</span>
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
            {isPublic 
              ? 'Mode Publik: Hanya untuk melihat jadwal.' 
              : 'Klik nama petugas untuk mengajukan tukar atau mengelola piket'}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <div className="col-span-2 sm:col-span-1 flex items-center bg-slate-900 border border-white/10 rounded-xl px-3 py-2 gap-2 shadow-md justify-center">
            <select
              value={viewMonth}
              onChange={(e) => setViewMonth(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
            >
              {namaBulan.map((bln, i) => (
                <option key={i + 1} value={i + 1} className="bg-slate-900 text-white">{bln}</option>
              ))}
            </select>
            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
            >
              {[2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                <option key={yr} value={yr} className="bg-slate-900 text-white">{yr}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setAbsenSubMenuOpen(true)}
            className="px-3 py-2 rounded-xl bg-teal-600/80 hover:bg-teal-500 border border-teal-500/50 text-white font-extrabold text-[11px] sm:text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <FontAwesomeIcon icon={faClipboardCheck} />
            <span>Absen Piket & Rekap</span>
          </button>

          <button
            onClick={() => setSdmFilterSubMenuOpen(true)}
            className={`px-3 py-2 rounded-xl font-extrabold text-[11px] sm:text-xs shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              filterStaffId 
                ? 'bg-emerald-600 text-white shadow-emerald-900/50 animate-pulse' 
                : 'bg-indigo-950/80 border border-indigo-500/40 text-indigo-300 hover:bg-indigo-900'
            }`}
          >
            <FontAwesomeIcon icon={faFilter} />
            <span className="truncate">{filterStaffId ? `Filter: ${getStaffName(filterStaffId).split(' ')[0]}` : 'Filter SDM'}</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] sm:text-xs shadow-3d-button flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <FontAwesomeIcon icon={faFilePdf} />
            <span>Export PDF</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => setLogsSubMenuOpen(true)}
              className="px-3 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white font-extrabold text-[11px] sm:text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <FontAwesomeIcon icon={faHistory} />
              <span>Log ({swapLogs.length})</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleToggleLockSchedule}
              className={`px-3 py-2 rounded-xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isScheduleLocked
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10'
              }`}
            >
              <FontAwesomeIcon icon={isScheduleLocked ? faLock : faUnlock} />
              <span>{isScheduleLocked ? 'Terkunci' : 'Kunci'}</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={handleResetMonthlySchedule}
              className="px-3 py-2 rounded-xl bg-rose-950/80 hover:bg-rose-900 border border-rose-500/50 text-rose-300 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
              title="Reset Seluruh Jadwal Piket Bulan Ini"
            >
              <FontAwesomeIcon icon={faTrashAlt} />
              <span>Reset</span>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setGenModalOpen(true)}
              className={`col-span-2 sm:col-span-1 px-4 py-2 rounded-xl font-bold text-xs shadow-3d-button flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                isScheduleLocked ? 'bg-indigo-900/50 text-slate-400 border border-white/10' : 'bg-indigo-600 hover:bg-indigo-500 text-white'
              }`}
            >
              <FontAwesomeIcon icon={faSync} />
              <span>Acak Piket</span>
            </button>
          )}
        </div>
      </div>

      {filterStaffId && (
        <div className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/50 flex justify-between items-center gap-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold truncate">
            <FontAwesomeIcon icon={faUser} />
            <span className="truncate">
              Disaring: <strong className="text-white uppercase">{getStaffName(filterStaffId)}</strong> ({selectedStaffScheduleSummary.length} Hari Tugas)
            </span>
          </div>
          <button
            onClick={() => setFilterStaffId('')}
            className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer shrink-0"
          >
            Bersihkan
          </button>
        </div>
      )}

      {/* KALENDER TAMPILAN JADWAL PIKET */}
      <div className="space-y-5 relative z-0">
        {Object.keys(weeksMap).length > 0 ? (
          Object.entries(weeksMap).map(([weekNum, daysInWeek]) => (
            <div key={weekNum} className="p-3.5 sm:p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-3d-glass">
              <h3 className="text-xs sm:text-sm font-extrabold text-indigo-300 uppercase tracking-wider mb-3">
                MINGGU KE-{weekNum}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {weekDaysHeader.map((dayName) => {
                  const dayData = daysInWeek[dayName];
                  if (!dayData) {
                    return (
                      <div key={dayName} className="p-3 rounded-2xl bg-slate-950/40 border border-white/5 opacity-40 hidden md:block">
                        <span className="text-xs font-bold text-slate-500">{dayName}</span>
                        <p className="text-[10px] text-slate-600 mt-2 italic">Luar Hari Kerja</p>
                      </div>
                    );
                  }

                  const assignedList = Array.isArray(dayData.assigned) ? dayData.assigned : [];
                  const swappedMap = dayData.swappedInfo || {};
                  const isToday = dayData.dateStr === todayStr;

                  return (
                    <div
                      key={dayData.dateStr}
                      className={`relative p-3 sm:p-4 rounded-2xl border backdrop-blur-md transition-all ${
                        isToday 
                          ? 'bg-slate-800/80 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.3)] ring-1 ring-cyan-400' 
                          : dayData.isHoliday
                          ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                          : 'bg-white/5 border-white/10 hover:border-indigo-500/40'
                      }`}
                    >
                      {isToday && (
                        <>
                          <div className="absolute inset-0 bg-cyan-400/5 rounded-2xl animate-pulse pointer-events-none"></div>
                          <div className="absolute -top-3 -right-2 bg-cyan-500 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-[0_0_10px_#22d3ee] z-10 border border-cyan-300">
                            HARI INI
                          </div>
                        </>
                      )}

                      <div className="text-center pb-2 border-b border-white/10 mb-2.5 relative z-10">
                        <span className={`text-[10px] sm:text-[11px] font-bold block uppercase ${isToday ? 'text-cyan-300' : 'text-slate-300'}`}>{dayName}</span>
                        <span className={`text-xs font-black mt-0.5 inline-block px-3 py-0.5 rounded-full ${
                          dayData.isHoliday 
                            ? 'bg-rose-600 text-white shadow-md' 
                            : isToday
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                            : 'bg-indigo-950/80 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          Tanggal {dayData.dayNumber}
                        </span>
                      </div>

                      <div className="space-y-2 relative z-10">
                        {!dayData.isHoliday ? (
                          <>
                            {assignedList.length > 0 ? (
                              assignedList.map((staffId) => {
                                const isSwapped = !!swappedMap[staffId];
                                const swapMeta = swappedMap[staffId];

                                const pendingReq = pendingRequests.find(
                                  (r) => (r.staffA === staffId && r.dateA === dayData.dateStr) || (r.staffB === staffId && r.dateB === dayData.dateStr)
                                );

                                const isStaffA = pendingReq?.staffA === staffId;
                                const partnerStaffId = pendingReq ? (isStaffA ? pendingReq.staffB : pendingReq.staffA) : '';
                                const partnerDayNum = pendingReq ? (isStaffA ? pendingReq.dayNumberB : pendingReq.dayNumberA) : '';

                                const showSwapHighlight = !isAdmin && isSwapped;
                                const isFilteredSdm = filterStaffId && filterStaffId === staffId;

                                // DATA ABSEN
                                const staffAtt = attendanceData[dayData.dateStr]?.[staffId];
                                const currentStatus = staffAtt ? staffAtt.status : null;

                                return (
                                  <div
                                    key={staffId}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleCardClick(dayData.dateStr, staffId)}
                                    className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col justify-center min-h-[44px] group relative ${isPublic ? 'cursor-default' : 'cursor-pointer'} ${
                                      isFilteredSdm
                                        ? 'bg-emerald-600/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400'
                                        : pendingReq
                                        ? 'bg-amber-950/80 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                                        : showSwapHighlight
                                        ? 'bg-orange-950/80 border-orange-500/70 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                                        : isToday
                                        ? `bg-cyan-950/40 border-cyan-500/30 ${isPublic ? '' : 'hover:bg-cyan-900/60'}`
                                        : `bg-slate-950/80 border-white/10 ${isPublic ? '' : 'hover:bg-indigo-600/30'}`
                                    }`}
                                  >
                                    <div className="flex justify-between items-center w-full gap-1.5 pr-5">
                                      <span className={`text-[11px] font-bold tracking-wide break-words leading-tight uppercase block flex-1 ${
                                        isFilteredSdm ? 'text-emerald-200 font-extrabold' : 'text-white'
                                      }`}>
                                        {getStaffName(staffId)}
                                      </span>
                                      <FontAwesomeIcon icon={faExchangeAlt} className={`text-[10px] text-amber-400 shrink-0 opacity-80 sm:opacity-0 ${isPublic ? 'hidden' : 'group-hover:opacity-100'} transition-opacity`} />
                                    </div>

                                    {/* ICON ABSEN QUICK DI KALENDER */}
                                    {!isPublic && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation(); 
                                          handleOpenAbsenModal(dayData.dateStr, staffId, currentStatus || 'Hadir');
                                        }}
                                        className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-lg bg-teal-900/50 border border-teal-500/40 text-[10px] text-teal-400 hover:bg-teal-500 hover:text-white transition-all z-20 cursor-pointer"
                                        title="Isi/Edit Absen"
                                      >
                                        <FontAwesomeIcon icon={faClipboardCheck} />
                                      </button>
                                    )}

                                    {/* BADGE ABSENSI */}
                                    {currentStatus && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                          currentStatus === 'Hadir' ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30' : 
                                          currentStatus === 'Alpa' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                                          'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                        }`}>
                                          {currentStatus === 'Hadir' ? '✓' : currentStatus === 'Alpa' ? '✗' : '⚠'} {currentStatus}
                                        </span>
                                      </div>
                                    )}
                                    {/* INFO JAM DATANG DAN PULANG */}
                                    {currentStatus === 'Hadir' && staffAtt && (
                                      <div className="mt-0.5 flex flex-col gap-0.5">
                                        {staffAtt.waktuDatang && (
                                           <span className="text-[8.5px] text-teal-200 font-medium">Masuk: {staffAtt.waktuDatang}</span>
                                        )}
                                        {staffAtt.waktuPulang && (
                                           <span className="text-[8.5px] text-amber-200 font-medium">Pulang: {staffAtt.waktuPulang}</span>
                                        )}
                                        {staffAtt.jamKerja !== undefined && (
                                           <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10 w-fit mt-0.5">
                                             <FontAwesomeIcon icon={faClock} className="mr-1" />{staffAtt.jamKerja} Jam
                                           </span>
                                        )}
                                      </div>
                                    )}
                                    {staffAtt?.keterangan && (
                                       <div className="mt-0.5 text-[9px] text-slate-400 italic truncate" title={staffAtt.keterangan}>
                                          Ket: {staffAtt.keterangan}
                                       </div>
                                    )}

                                    {pendingReq && (
                                      <div className="mt-1 space-y-0.5">
                                        <span className="text-[9px] font-bold text-amber-300 block leading-tight break-words">
                                          ⇄ Usulan Tukar dgn {getStaffName(partnerStaffId)} tgl {partnerDayNum}
                                        </span>
                                        <span className="text-[9px] font-extrabold text-amber-400 flex items-center gap-1">
                                          <FontAwesomeIcon icon={faHourglassHalf} className="animate-spin text-[8px]" />
                                          <span>{renderCountdown(pendingReq.timestamp)}</span>
                                        </span>
                                      </div>
                                    )}

                                    {!isAdmin && !pendingReq && isSwapped && (
                                      <span className="text-[9px] font-bold text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-400/40 inline-block mt-1 break-words leading-tight">
                                        🔄 Tukar dgn {getStaffName(swapMeta.original)} tgl {swapMeta.swappedDateNum || swapMeta.originalDateNum}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-[10px] text-slate-500 italic py-2 text-center">Belum ada petugas</p>
                            )}
                            
                            {isAdmin && !isScheduleLocked && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenAddModal(dayData.dateStr);
                                }}
                                className="mt-2 w-full py-1.5 rounded-xl border border-dashed border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-400 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm relative z-20"
                                title="Tambah Petugas Baru Secara Manual ke Tanggal Ini"
                              >
                                <FontAwesomeIcon icon={faPlus} className="text-[9px]" />
                                <span>Tambah Petugas</span>
                              </button>
                            )}
                          </>
                        ) : (
                          <div className="text-center py-2">
                            <span className="text-xs font-black text-rose-200 block uppercase tracking-wider leading-tight">
                              {dayData.holidayTitle || 'TANGGAL MERAH'}
                            </span>
                            <span className="text-[9px] text-rose-300/80 block mt-1 font-semibold">HARI LIBUR RESMI</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 sm:p-12 text-center rounded-3xl bg-slate-900/60 border border-white/10 text-slate-400 space-y-3">
            <p className="text-xs sm:text-sm">Belum ada jadwal piket untuk bulan <strong className="text-white">{namaBulan[viewMonth - 1]} {viewYear}</strong>.</p>
            {isAdmin && (
              <button
                onClick={() => setGenModalOpen(true)}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs inline-flex items-center gap-2 cursor-pointer transition-all"
              >
                <FontAwesomeIcon icon={faSync} />
                <span>Acak Piket Bulan Ini Sekarang</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* --- FORM ABSENSI (MODAL KECIL BARU DENGAN DATANG & PULANG) --- */}
      {showAbsenFormModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm p-6 rounded-3xl bg-slate-900 border border-teal-500/50 shadow-2xl relative max-h-[95vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setShowAbsenFormModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer">
               <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 className="text-base font-black text-white flex items-center gap-2 mb-1">
              <FontAwesomeIcon icon={faClipboardCheck} className="text-teal-400" /> Form Absensi Piket
            </h3>
            <p className="text-xs text-slate-300 font-semibold mb-4 pb-3 border-b border-white/10">
              {getStaffName(absenFormData.staffId)} - {new Date(absenFormData.dateStr).getDate()} {namaBulan[viewMonth-1]} {viewYear}
            </p>

            <form onSubmit={handleSubmitAbsen} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Status Kehadiran</label>
                <select
                  value={absenFormData.status}
                  onChange={(e) => setAbsenFormData({...absenFormData, status: e.target.value})}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-teal-400 cursor-pointer"
                >
                  <option value="Hadir">Hadir (Sesuai Jadwal)</option>
                  <option value="Izin/Sakit">Izin / Sakit / Alasan Lain</option>
                  <option value="Alpa">Tanpa Keterangan (Alpa)</option>
                </select>
              </div>

              {/* INPUT JAM DATANG DAN PULANG HANYA JIKA HADIR */}
              {absenFormData.status === 'Hadir' && (
                <div className="space-y-3 bg-slate-950/60 p-3 rounded-xl border border-white/5">
                  {/* ABSEN DATANG */}
                  <div>
                     <label className="text-[10px] text-slate-400 block mb-1 font-bold">Absen Datang (Clock In)</label>
                     <div className="flex gap-2 items-center">
                        {isAdmin ? (
                           <input 
                             type="time" 
                             value={absenFormData.waktuDatang} 
                             onChange={e => handleTimeChange('waktuDatang', e.target.value)} 
                             className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-400"
                           />
                        ) : (
                           <div className="flex-1 bg-slate-900 border border-white/10 px-3 py-2 rounded-lg text-white text-xs font-mono">
                             {absenFormData.waktuDatang || '--:--'}
                           </div>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleAutoTime('waktuDatang')} 
                          className="px-3 py-2 bg-teal-600 hover:bg-teal-500 rounded-lg text-xs font-bold text-white shadow-sm transition-all cursor-pointer whitespace-nowrap"
                        >
                          <FontAwesomeIcon icon={faSignInAlt} /> Sekarang
                        </button>
                     </div>
                  </div>

                  {/* ABSEN PULANG */}
                  <div>
                     <label className="text-[10px] text-slate-400 block mb-1 font-bold">Absen Pulang (Clock Out)</label>
                     <div className="flex gap-2 items-center">
                        {isAdmin ? (
                           <input 
                             type="time" 
                             value={absenFormData.waktuPulang} 
                             onChange={e => handleTimeChange('waktuPulang', e.target.value)} 
                             className="flex-1 bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-white text-xs outline-none focus:border-teal-400"
                           />
                        ) : (
                           <div className="flex-1 bg-slate-900 border border-white/10 px-3 py-2 rounded-lg text-white text-xs font-mono">
                             {absenFormData.waktuPulang || '--:--'}
                           </div>
                        )}
                        <button 
                          type="button" 
                          onClick={() => handleAutoTime('waktuPulang')} 
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-xs font-bold text-white shadow-sm transition-all cursor-pointer whitespace-nowrap"
                        >
                          <FontAwesomeIcon icon={faSignOutAlt} /> Sekarang
                        </button>
                     </div>
                  </div>

                  {/* JAM KERJA */}
                  <div className="pt-2 border-t border-white/10">
                    <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
                      <FontAwesomeIcon icon={faClock} className="text-teal-300" /> Total Jam Piket Dijalankan
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      step="0.01"
                      value={absenFormData.jamKerja}
                      onChange={(e) => setAbsenFormData({...absenFormData, jamKerja: e.target.value})}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none focus:border-teal-400 cursor-not-allowed"
                      placeholder="Terhitung otomatis..."
                      readOnly={!isAdmin} 
                      required
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Standar Piket: 4 Jam. Kurang jam akan diakumulasi ke dalam denda.</p>
                  </div>
                </div>
              )}

              {/* INPUT KETERANGAN JIKA IZIN/SAKIT */}
              {(absenFormData.status === 'Izin/Sakit' || absenFormData.status === 'Lainnya') && (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5 flex items-center gap-1">
                    <FontAwesomeIcon icon={faCommentDots} className="text-amber-300" /> Keterangan Tambahan
                  </label>
                  <textarea
                    value={absenFormData.keterangan}
                    onChange={(e) => setAbsenFormData({...absenFormData, keterangan: e.target.value})}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-400 h-20 resize-none"
                    placeholder="Tulis alasan izin, sakit, atau kendala lain..."
                    required
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {isAdmin && (
                   <button 
                     type="button" 
                     onClick={handleDeleteAbsen} 
                     className="w-1/3 py-3 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-400 font-bold text-xs border border-rose-500/30 transition-all cursor-pointer"
                   >
                     Hapus Data
                   </button>
                )}
                <button
                  type="submit"
                  className={`${isAdmin ? 'w-2/3' : 'w-full'} py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer`}
                >
                  Simpan Data Absen
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- SUB-MENU MODAL 1: FILTER JADWAL PER SDM (LAMA) --- */}
      {sdmFilterSubMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-5 sm:p-7 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl relative space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button 
              onClick={() => setSdmFilterSubMenuOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
              <FontAwesomeIcon icon={faCalendarCheck} className="text-indigo-400" />
              <span>Cari / Filter Jadwal Piket SDM</span>
            </h3>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-2">
                Pilih Nama SDM / Petugas ({staffList.length} Orang Terdaftar):
              </label>
              <select
                value={filterStaffId}
                onChange={(e) => setFilterStaffId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-indigo-500/40 text-white text-xs font-bold outline-none focus:border-indigo-400 cursor-pointer"
              >
                <option value="">-- Pilih SDM untuk Melihat Rangkuman Jadwal --</option>
                {staffList.map((s, idx) => {
                  const sName = s.name || s.NAMA || s.nama || s.id;
                  const sId = s.id || s.key || idx;
                  return (<option key={sId} value={sId}>{sName}</option>);
                })}
              </select>
            </div>

            {filterStaffId ? (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h4 className="text-xs font-bold text-indigo-300 flex items-center justify-between">
                  <span>Rangkuman Piket {namaBulan[viewMonth - 1]} {viewYear}:</span>
                  <span className="bg-indigo-600/40 border border-indigo-400/30 text-white px-2.5 py-0.5 rounded-full text-[10px]">
                    {selectedStaffScheduleSummary.length} Hari Tugas
                  </span>
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                  {selectedStaffScheduleSummary.length > 0 ? (
                    selectedStaffScheduleSummary.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-2xl bg-slate-950 border border-indigo-500/20 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-emerald-400">
                            {item.dayName}, {item.dayNumber} {namaBulan[viewMonth - 1]} {viewYear}
                          </span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg">
                            Minggu ke-{item.weekIndex}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300">
                          Rekan Pasangan: <strong className="text-white">{item.partners.length > 0 ? item.partners.join(', ') : 'Piket Sendiri'}</strong>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-xs text-slate-500 py-6 italic border border-dashed border-white/10 rounded-2xl">
                      {getStaffName(filterStaffId)} tidak memiliki jadwal piket pada bulan {namaBulan[viewMonth - 1]} {viewYear}.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 text-center text-xs text-slate-400">
                Pilih nama petugas di atas untuk menampilkan seluruh hari piketnya pada bulan {namaBulan[viewMonth - 1]} {viewYear}.
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSdmFilterSubMenuOpen(false)}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-3d-button cursor-pointer"
              >
                Terapkan Filter & Lihat Halaman
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-MENU MODAL 2: LOG TUKAR PIKET (ADMIN) (LAMA) --- */}
      {isAdmin && logsSubMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-5 sm:p-7 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setLogsSubMenuOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="flex justify-between items-center pr-8">
              <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <FontAwesomeIcon icon={faHistory} className="text-amber-400" />
                <span>Sub-Menu Log Tukar ({namaBulan[viewMonth - 1]} {viewYear})</span>
              </h3>
              {swapLogs.length > 0 && (
                <button
                  onClick={handleClearAllLogs}
                  className="px-2.5 py-1 rounded-xl bg-rose-600/30 border border-rose-500/50 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <FontAwesomeIcon icon={faTrashAlt} />
                  <span>Bersihkan Semua</span>
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
              {swapLogs.length > 0 ? (
                swapLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-2xl bg-slate-950 border border-white/10 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-amber-300 font-bold">
                        {getStaffName(log.staffA)} {log.dayNumberA ? `(Tgl ${log.dayNumberA})` : ''} ⇄ {getStaffName(log.staffB)} {log.dayNumberB ? `(Tgl ${log.dayNumberB})` : ''}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Riwayat Bertukar'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteLog(log.id)}
                      className="text-slate-400 hover:text-rose-400 p-1.5 transition-colors cursor-pointer"
                      title="Hapus Log Ini"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-slate-500 py-6 italic">Belum ada riwayat log pertukaran piket.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 7: REKAPITULASI TABEL ABSENSI KESELURUHAN (DENGAN TAHUNAN & CRUD ADMIN) --- */}
      {absenSubMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-5xl p-5 sm:p-7 rounded-3xl bg-slate-900 border border-teal-500/40 shadow-2xl relative space-y-4 animate-fadeIn flex flex-col max-h-[95vh]">
            <button 
              onClick={() => setAbsenSubMenuOpen(false)} 
              className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5 shrink-0">
              <FontAwesomeIcon icon={faClipboardCheck} className="text-teal-400" />
              <span>
                 {rekapMode === 'Tahunan' 
                   ? `Evaluasi Tahunan Piket & Absensi (${rekapYearFilter})` 
                   : `Tabel Rekapitulasi Piket & Absensi (${namaBulan[viewMonth - 1]} ${viewYear})`}
              </span>
            </h3>

            {/* TAB SWITCH BULANAN / TAHUNAN (KHUSUS ADMIN) */}
            {isAdmin && (
              <div className="flex gap-2 bg-slate-950 p-1.5 rounded-xl w-fit border border-white/5 shrink-0">
                 <button 
                   onClick={() => setRekapMode('Bulanan')} 
                   className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${rekapMode === 'Bulanan' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'}`}
                 >
                   Rekap Bulanan
                 </button>
                 <button 
                   onClick={() => setRekapMode('Tahunan')} 
                   className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${rekapMode === 'Tahunan' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-900'}`}
                 >
                   Evaluasi Tahunan
                 </button>
              </div>
            )}

            {/* KOMPONEN FILTER & INPUT CEPAT */}
            <div className="p-3 bg-slate-950/80 border border-teal-500/20 rounded-xl flex items-center gap-3 shrink-0 flex-wrap">
               {rekapMode === 'Bulanan' ? (
                 <>
                   <label className="text-[11px] text-slate-300 font-bold w-full sm:w-auto">Isi Cepat Absen Tanggal:</label>
                   <select
                      value={absenSelectedDate}
                      onChange={(e) => setAbsenSelectedDate(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-xs outline-none focus:border-teal-400 flex-1 min-w-[200px] cursor-pointer"
                    >
                      <option value="">-- Pilih Tanggal Tugas --</option>
                      {Object.entries(currentSchedule)
                        .filter(([key, val]) => key !== 'isLocked' && !val.isHoliday)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([dStr, dData]) => (
                          <option key={dStr} value={dStr}>
                            {dData.dayName}, {dData.dayNumber} {namaBulan[viewMonth - 1]}
                          </option>
                        ))}
                    </select>
                    <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto">
                        {absenSelectedDate && Array.isArray(currentSchedule[absenSelectedDate]?.assigned) ? (
                            currentSchedule[absenSelectedDate].assigned.map(staffId => (
                               <button
                                 key={staffId}
                                 onClick={() => handleOpenAbsenModal(absenSelectedDate, staffId)}
                                 className="px-3 py-2 text-[10px] font-bold rounded-lg bg-teal-600/30 border border-teal-500/50 hover:bg-teal-500 text-teal-200 hover:text-white transition-all whitespace-nowrap cursor-pointer"
                               >
                                 Absen {getStaffName(staffId).split(' ')[0]}
                               </button>
                            ))
                        ) : (
                            <span className="text-[10px] text-slate-500 italic py-2">Pilih Tgl / Tidak ada jadwal.</span>
                        )}
                    </div>
                 </>
               ) : (
                 <div className="flex items-center gap-3 w-full">
                    <label className="text-[11px] text-indigo-300 font-bold">Pilih Tahun Evaluasi:</label>
                    <select
                      value={rekapYearFilter}
                      onChange={(e) => setRekapYearFilter(Number(e.target.value))}
                      className="px-4 py-2 rounded-lg bg-slate-900 border border-indigo-500/50 text-white text-xs font-bold outline-none focus:border-indigo-400 cursor-pointer"
                    >
                      {[2025, 2026, 2027, 2028, 2029, 2030].map(yr => (
                        <option key={yr} value={yr}>Tahun {yr}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-400 italic">Data tahunan mencakup seluruh rekapitulasi hitungan denda dan absen selama 1 tahun penuh.</p>
                 </div>
               )}
            </div>

            {/* TABEL KESELURUHAN */}
            <div className="flex-1 overflow-auto rounded-xl border border-white/10 bg-slate-950 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                <thead className="bg-slate-900 sticky top-0 z-10 shadow-md">
                  <tr>
                    <th className="p-3 border-b border-white/10 font-black text-slate-300">Nama Petugas SDM</th>
                    <th className="p-3 border-b border-white/10 font-bold text-center text-slate-400">Jatah Piket</th>
                    <th className="p-3 border-b border-white/10 font-bold text-center text-teal-400">Hadir</th>
                    <th className="p-3 border-b border-white/10 font-bold text-center text-amber-400">Izin/Sakit</th>
                    <th className="p-3 border-b border-white/10 font-bold text-center text-rose-400">Alpa</th>
                    {isAdmin && (
                      <>
                        <th className="p-3 border-b border-white/10 font-bold text-center text-orange-400 border-l border-white/5">Kurang Jam</th>
                        <th className="p-3 border-b border-white/10 font-bold text-right text-orange-400">Denda Jam</th>
                        <th className="p-3 border-b border-white/10 font-bold text-right text-rose-500">Denda Alpa</th>
                        <th className="p-3 border-b border-white/10 font-black text-right text-white">Total Denda</th>
                        <th className="p-3 border-b border-white/10 font-bold text-center text-slate-500 border-l border-white/5">Aksi</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayedStatsArray.length > 0 ? (
                    displayedStatsArray.map((stat, idx) => (
                      <tr key={stat.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-slate-900/30'}`}>
                        <td className="p-3 font-bold text-white max-w-[150px] truncate" title={stat.name}>{stat.name}</td>
                        <td className="p-3 text-center text-slate-300 font-black bg-slate-800/30">{stat.totalJatah}</td>
                        <td className="p-3 text-center text-teal-300 font-bold">{stat.totalHadir}</td>
                        <td className="p-3 text-center text-amber-300 font-bold">{stat.totalIzin}</td>
                        <td className="p-3 text-center text-rose-300 font-bold">{stat.totalAlpa}</td>
                        {isAdmin && (
                          <>
                            <td className="p-3 text-center text-orange-300 font-bold border-l border-white/5">
                              {stat.totalKurangJam > 0 ? `${stat.totalKurangJam} Jam` : '-'}
                            </td>
                            <td className="p-3 text-right text-orange-300 font-mono tracking-tighter">
                              {stat.dendaJam > 0 ? `Rp ${(stat.dendaJam).toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="p-3 text-right text-rose-400 font-mono tracking-tighter">
                              {stat.dendaAlpa > 0 ? `Rp ${(stat.dendaAlpa).toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="p-3 text-right text-white font-black font-mono tracking-tighter bg-rose-950/20">
                              {stat.totalDenda > 0 ? `Rp ${(stat.totalDenda).toLocaleString('id-ID')}` : '-'}
                            </td>
                            <td className="p-3 text-center border-l border-white/5">
                               <button 
                                 onClick={() => handleHideStaff(stat.id)}
                                 className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600/80 text-slate-400 hover:text-white transition-colors cursor-pointer"
                                 title="Sembunyikan Staf dari Rekap"
                               >
                                  <FontAwesomeIcon icon={faEyeSlash} />
                               </button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 5} className="p-8 text-center text-slate-500 italic">Data petugas tidak ditemukan atau kosong.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* DAFTAR NAMA YANG DISEMBUNYIKAN & KETENTUAN DENDA */}
            {isAdmin && (
               <div className="shrink-0 space-y-2">
                  {hiddenStaff.length > 0 && (
                     <div className="p-3 bg-slate-900 border border-white/10 rounded-xl">
                       <h4 className="text-[10px] text-slate-400 font-bold mb-2">Petugas yang Disembunyikan (Klik untuk memulihkan):</h4>
                       <div className="flex flex-wrap gap-2">
                         {hiddenStaff.map(id => (
                           <button 
                             key={id} 
                             onClick={() => handleRestoreStaff(id)} 
                             className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white text-[10px] font-bold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                             title="Kembalikan nama ini ke dalam tabel rekap"
                           >
                             <FontAwesomeIcon icon={faUndo} className="text-teal-400" />
                             {getStaffName(id)}
                           </button>
                         ))}
                       </div>
                     </div>
                  )}

                  <div className="p-3 bg-rose-950/30 border border-rose-500/20 rounded-xl text-[10px] text-rose-200">
                     <strong className="text-rose-400"><FontAwesomeIcon icon={faMoneyBillWave}/> Ketentuan Denda (Hanya Tampil di Admin):</strong> 
                     <ul className="list-disc pl-4 mt-1">
                       <li>Standar piket adalah 4 Jam. Kekurangan jam piket didenda <strong>Rp 10.000 / Jam</strong>.</li>
                       <li>Tanpa keterangan / Alpa didenda tetap <strong>Rp 50.000 / Hari</strong>.</li>
                     </ul>
                  </div>
               </div>
            )}
          </div>
        </div>
      )}

      {/* --- MODAL 3: GENERATE PIKET (LAMA) --- */}
      {genModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-2xl relative space-y-5">
            <button onClick={() => setGenModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faSync} className="text-indigo-400" />
              <span>Acak Piket Otomatis</span>
            </h3>
            {isScheduleLocked && (
              <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs flex items-center gap-2">
                <FontAwesomeIcon icon={faLock} />
                <span>Jadwal bulan ini DIKUNCI. Mengacak ulang akan memperbarui jadwal.</span>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Bulan Target Acak</label>
                <select
                  value={genMonth}
                  onChange={(e) => setGenMonth(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                >
                  {namaBulan.map((bulan, idx) => (<option key={idx + 1} value={idx + 1}>{bulan}</option>))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Tahun Target</label>
                <select
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                >
                  {[2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (<option key={yr} value={yr}>Tahun {yr}</option>))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGenModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >Batal</button>
              <button
                type="button"
                onClick={handleGeneratePiket}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg cursor-pointer"
              >Mulai Acak & Simpan ({namaBulan[genMonth - 1]} {genYear})</button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: INISIASI TUKAR (LAMA) --- */}
      {swapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-3d-glass relative space-y-4">
            <button onClick={() => setSwapModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faExchangeAlt} className="text-amber-400" />
              <span>{isAdmin ? 'Kelola / Tukar Piket (Mode Admin)' : 'Ajukan Tukar Piket'}</span>
            </h3>
            <p className="text-xs text-slate-300">
              Petugas Terpilih: <span className="font-bold text-amber-300">{getStaffName(selectedStaffA)}</span> (Tanggal {new Date(selectedDateA).getDate()})
            </p>
            <form onSubmit={handleCreateSwapRequest} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Pilih Tanggal Pasangan Tukar</label>
                <select
                  value={selectedDateB}
                  onChange={(e) => setSelectedDateB(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- Pilih Tanggal --</option>
                  {Object.keys(currentSchedule).filter(k => k !== 'isLocked').map((dStr) => (
                    <option key={dStr} value={dStr}>Tanggal {currentSchedule[dStr].dayNumber} ({currentSchedule[dStr].dayName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Pilih Petugas Pasangan Tukar</label>
                <select
                  value={selectedStaffB}
                  onChange={(e) => setSelectedStaffB(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-500 cursor-pointer"
                >
                  <option value="">-- Pilih Petugas --</option>
                  {(currentSchedule[selectedDateB]?.assigned || []).map((sId) => (<option key={sId} value={sId}>{getStaffName(sId)}</option>))}
                </select>
              </div>
              <button
                type="submit"
                className={`w-full py-3 rounded-2xl font-bold text-xs shadow-3d-button transition-all cursor-pointer ${isAdmin ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'}`}
              >
                {isAdmin ? 'Eksekusi Tukar Instan (Tanpa Tanda)' : 'Kirim Pengajuan (Batas 8 Jam Konfirmasi)'}
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleRemoveStaffFromDate}
                  className="w-full py-2.5 rounded-2xl bg-rose-600/30 hover:bg-rose-600 border border-rose-500/50 text-rose-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
                >
                  <FontAwesomeIcon icon={faTrashAlt} />
                  <span>Hapus {getStaffName(selectedStaffA)} dari Tanggal Ini</span>
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 5: KONFIRMASI DUA PIHAK (LAMA) --- */}
      {confirmModalOpen && activeRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-amber-500/50 shadow-3d-glass relative space-y-5">
            <button onClick={() => setConfirmModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="flex items-center gap-3 text-amber-400">
              <FontAwesomeIcon icon={faExchangeAlt} className="text-2xl" />
              <div>
                <h3 className="text-base font-bold text-white">Konfirmasi Persetujuan Tukar</h3>
                <p className="text-[10px] text-amber-300 font-semibold flex items-center gap-1 mt-0.5">
                  <FontAwesomeIcon icon={faClock} />
                  <span>Sisa Waktu: {renderCountdown(activeRequest.timestamp)}</span>
                </p>
              </div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-white/10 space-y-2 text-xs text-slate-200">
              <p>• <span className="font-bold text-amber-300">{getStaffName(activeRequest.staffA)}</span> (Tanggal {activeRequest.dayNumberA})</p>
              <p>• <span className="font-bold text-cyan-300">{getStaffName(activeRequest.staffB)}</span> (Tanggal {activeRequest.dayNumberB})</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1.5">{getStaffName(activeRequest.staffA)}:</span>
                <button
                  onClick={() => handleToggleApprove('A')}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${activeRequest.approvedA ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 hover:bg-emerald-600/50 text-slate-200'}`}
                >
                  <FontAwesomeIcon icon={faUserCheck} className="mr-1" />{activeRequest.approvedA ? '✓ Setuju' : 'Klik Setuju'}
                </button>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block mb-1.5">{getStaffName(activeRequest.staffB)}:</span>
                <button
                  onClick={() => handleToggleApprove('B')}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${activeRequest.approvedB ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 hover:bg-emerald-600/50 text-slate-200'}`}
                >
                  <FontAwesomeIcon icon={faUserCheck} className="mr-1" />{activeRequest.approvedB ? '✓ Setuju' : 'Klik Setuju'}
                </button>
              </div>
            </div>
            <button
              onClick={async () => {
                await remove(ref(db, `swapRequests/${activeRequest.id}`));
                setConfirmModalOpen(false);
                showToast('Pengajuan tukar piket dibatalkan.', 'info');
              }}
              className="w-full py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 text-rose-300 font-semibold text-xs transition-all cursor-pointer"
            >Batalkan Pengajuan Tukar</button>
          </div>
        </div>
      )}

      {/* --- MODAL 6: TAMBAH PETUGAS (LAMA) --- */}
      {isAdmin && addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-3d-glass relative space-y-4">
            <button onClick={() => setAddModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer">
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faUserCheck} className="text-emerald-400" />
              <span>Tambah Petugas Manual</span>
            </h3>
            <p className="text-[11px] text-emerald-300 font-semibold bg-emerald-950/50 p-2 rounded-xl border border-emerald-500/30">
              Pilih petugas untuk ditambahkan ke: <strong>Tanggal {new Date(selectedDateToAdd).getDate()} {namaBulan[viewMonth - 1]} {viewYear}</strong>
            </p>
            <form onSubmit={handleAddStaff} className="space-y-4 pt-1">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">Daftar Semua Petugas Terdaftar</label>
                <select
                  value={selectedStaffToAdd}
                  onChange={(e) => setSelectedStaffToAdd(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">-- Pilih Petugas yang Akan Ditambahkan --</option>
                  {staffList.map((s) => (<option key={s.id || s.key} value={s.id || s.key}>{s.name || s.NAMA || s.nama || s.id}</option>))}
                </select>
              </div>
              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-3d-button transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>Validasi & Simpan Penambahan</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
