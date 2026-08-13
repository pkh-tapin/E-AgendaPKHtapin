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
  faCalendarCheck
} from '@fortawesome/free-solid-svg-icons';

export default function PiketView({ schedules = {}, staffList = [], config = {}, holidays = {}, isAdmin }) {
  const { showToast } = useToast();
  const now = new Date();

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

  // ---------------------------------------------------------------------------
  // 2. STATE SUB-MENU FILTER JADWAL SDM
  // ---------------------------------------------------------------------------
  const [sdmFilterSubMenuOpen, setSdmFilterSubMenuOpen] = useState(false);
  const [filterStaffId, setFilterStaffId] = useState('');

  // Helper Resolver Nama SDM
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
  // 4. STATE MODAL TUKAR & REALTIME TIMER
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

  // Realtime Timer 1 Detik
  useEffect(() => {
    const timer = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Usulan Tukar Realtime (Auto-Delete > 8 Jam)
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

  // Fetch Log Pertukaran Realtime (Scope Per Bulan)
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

  // FITUR RESET SELURUH JADWAL BULAN INI (ADMIN)
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

  // FITUR HAPUS PETUGAS SATUAN DARI TANGGAL PIKET (ADMIN)
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
        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/swappedInfo`), swappedInfoA);

        showToast(`Petugas ${getStaffName(selectedStaffA)} berhasil dihapus dari tanggal ${dayNum}!`, 'success');
        setSwapModalOpen(false);
      } catch (err) {
        showToast('Gagal menghapus petugas piket.', 'error');
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 6. HANDLER TUKAR PIKET (ADMIN = INSTANT, USER = 8 JAM)
  // ---------------------------------------------------------------------------
  const handleCreateSwapRequest = async (e) => {
    e.preventDefault();
    if (!selectedDateB || !selectedStaffB) return showToast('Pilih tanggal & petugas pasangan tukar!', 'error');
    if (selectedDateA === selectedDateB && selectedStaffA === selectedStaffB) return showToast('Tidak bisa menukar petugas yang sama!', 'error');

    const dayNumA = new Date(selectedDateA).getDate();
    const dayNumB = new Date(selectedDateB).getDate();

    // AKSI ADMIN: EKSEKUSI BERSIH TANPA MENCATAT SWAPPED INFO
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
        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateA}/swappedInfo`), swappedInfoA);

        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateB}/assigned`), newAssignedB);
        await set(ref(db, `schedules/${currentMonthKey}/${selectedDateB}/swappedInfo`), swappedInfoB);

        showToast('Admin berhasil menukar jadwal secara langsung (Tanpa Tanda)!', 'success');
        setSwapModalOpen(false);
        return;
      } catch (err) {
        return showToast('Gagal memproses pertukaran jadwal oleh Admin.', 'error');
      }
    }

    // MODE USER BIASA: USULAN TUKAR 8 JAM
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

  // HANDLER KONFIRMASI DUA PIHAK
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

        // Catat Log Pertukaran User
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

  // HAPUS LOG SATUAN (ADMIN)
  const handleDeleteLog = async (logId) => {
    if (!isAdmin) return showToast('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('Hapus riwayat log tukar ini dari sistem?')) {
      await remove(ref(db, `swaps/${logId}`));
      showToast('Log tukar berhasil dihapus!', 'info');
    }
  };

  // HAPUS SEMUA LOG (ADMIN)
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

  // Rangkuman Jadwal SDM Terpilih
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
    <div className="space-y-5 animate-fadeIn max-w-full">
      {/* HEADER BAR & CONTROL PANEL MOBILE-FIRST PRESISI */}
      <div className="flex justify-between items-center flex-wrap gap-3 sm:gap-4">
        <div>
          <h2 className="text-base sm:text-2xl font-black text-white flex items-center gap-2">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-indigo-400 text-sm sm:text-xl" />
            <span>Jadwal Piket Bulanan</span>
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
            Klik nama petugas untuk mengajukan tukar atau mengelola piket
          </p>
        </div>

        {/* TOOLBAR BUTTONS RESPONSIVE GRID/FLEX */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          {/* Selector Tampilan Bulan & Tahun Kalender */}
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

          {/* SUB-MENU FILTER JADWAL SDM */}
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

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] sm:text-xs shadow-3d-button flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <FontAwesomeIcon icon={faFilePdf} />
            <span>Export PDF</span>
          </button>

          {/* SUB-MENU LOG TUKAR PIKET (ADMIN) */}
          {isAdmin && (
            <button
              onClick={() => setLogsSubMenuOpen(true)}
              className="px-3 py-2 rounded-xl bg-amber-600/80 hover:bg-amber-500 text-white font-extrabold text-[11px] sm:text-xs shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              <FontAwesomeIcon icon={faHistory} />
              <span>Log ({swapLogs.length})</span>
            </button>
          )}

          {/* Lock/Unlock Schedule (Admin) */}
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

          {/* Reset Schedule (Admin) */}
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

          {/* Acak Piket (Admin) */}
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

      {/* BANNER INDICATOR FILTER SDM DITAMPILKAN JIKA AKTIF */}
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
      <div className="space-y-5">
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

                  return (
                    <div
                      key={dayData.dateStr}
                      className={`p-3 sm:p-4 rounded-2xl border backdrop-blur-md transition-all ${
                        dayData.isHoliday
                          ? 'bg-rose-950/80 border-rose-500/80 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                          : 'bg-white/5 border-white/10 hover:border-indigo-500/40'
                      }`}
                    >
                      <div className="text-center pb-2 border-b border-white/10 mb-2.5">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-300 block uppercase">{dayName}</span>
                        <span className={`text-xs font-black mt-0.5 inline-block px-3 py-0.5 rounded-full ${
                          dayData.isHoliday ? 'bg-rose-600 text-white shadow-md' : 'bg-indigo-950/80 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          Tanggal {dayData.dayNumber}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {!dayData.isHoliday ? (
                          assignedList.length > 0 ? (
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

                              return (
                                <button
                                  key={staffId}
                                  onClick={() => handleCardClick(dayData.dateStr, staffId)}
                                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex flex-col justify-center min-h-[44px] group cursor-pointer ${
                                    isFilteredSdm
                                      ? 'bg-emerald-600/40 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] ring-2 ring-emerald-400'
                                      : pendingReq
                                      ? 'bg-amber-950/80 border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse'
                                      : showSwapHighlight
                                      ? 'bg-orange-950/80 border-orange-500/70 shadow-[0_0_10px_rgba(249,115,22,0.2)]'
                                      : 'bg-slate-950/80 border-white/10 hover:bg-indigo-600/30'
                                  }`}
                                >
                                  <div className="flex justify-between items-center w-full gap-1.5">
                                    <span className={`text-[11px] font-bold tracking-wide break-words leading-tight uppercase block flex-1 ${
                                      isFilteredSdm ? 'text-emerald-200 font-extrabold' : 'text-white'
                                    }`}>
                                      {getStaffName(staffId)}
                                    </span>
                                    <FontAwesomeIcon icon={faExchangeAlt} className="text-[10px] text-amber-400 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>

                                  {/* KETERANGAN MENUNGGU TUKAR */}
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

                                  {/* TANDA ORANGE BERTUKAR */}
                                  {!isAdmin && !pendingReq && isSwapped && (
                                    <span className="text-[9px] font-bold text-orange-300 bg-orange-500/20 px-1.5 py-0.5 rounded border border-orange-400/40 inline-block mt-1 break-words leading-tight">
                                      🔄 Tukar dgn {getStaffName(swapMeta.original)} tgl {swapMeta.swappedDateNum || swapMeta.originalDateNum}
                                    </span>
                                  )}
                                </button>
                              );
                            })
                          ) : (
                            <p className="text-[10px] text-slate-500 italic py-2 text-center">Belum ada petugas</p>
                          )
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

      {/* SUB-MENU MODAL 1: FILTER JADWAL PER SDM */}
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
                  return (
                    <option key={sId} value={sId}>
                      {sName}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* RANGKUMAN TANGGAL PIKET SDM TERPILIH */}
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

      {/* SUB-MENU MODAL 2: LOG TUKAR PIKET (ADMIN) */}
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

      {/* MODAL 3: GENERATE PIKET */}
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
                  {namaBulan.map((bulan, idx) => (
                    <option key={idx + 1} value={idx + 1}>{bulan}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">Tahun Target</label>
                <select
                  value={genYear}
                  onChange={(e) => setGenYear(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-white text-sm outline-none focus:border-indigo-500"
                >
                  {[2025, 2026, 2027, 2028, 2029, 2030].map((yr) => (
                    <option key={yr} value={yr}>Tahun {yr}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGenModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleGeneratePiket}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg cursor-pointer"
              >
                Mulai Acak & Simpan ({namaBulan[genMonth - 1]} {genYear})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INISIASI TUKAR & MANAJEMEN HAPUS PETUGAS PIKET */}
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
                    <option key={dStr} value={dStr}>
                      Tanggal {currentSchedule[dStr].dayNumber} ({currentSchedule[dStr].dayName})
                    </option>
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
                  {(currentSchedule[selectedDateB]?.assigned || []).map((sId) => (
                    <option key={sId} value={sId}>{getStaffName(sId)}</option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className={`w-full py-3 rounded-2xl font-bold text-xs shadow-3d-button transition-all cursor-pointer ${
                  isAdmin ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {isAdmin ? 'Eksekusi Tukar Instan (Tanpa Tanda & Tanpa Menunggu)' : 'Kirim Pengajuan (Batas 8 Jam Konfirmasi)'}
              </button>

              {/* TOMBOL KHUSUS ADMIN: HAPUS PETUGAS SATUAN */}
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

      {/* MODAL 5: KONFIRMASI DUA PIHAK USER BIASA */}
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
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeRequest.approvedA ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 hover:bg-emerald-600/50 text-slate-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faUserCheck} className="mr-1" />
                  {activeRequest.approvedA ? '✓ Setuju' : 'Klik Setuju'}
                </button>
              </div>

              <div>
                <span className="text-[10px] text-slate-400 block mb-1.5">{getStaffName(activeRequest.staffB)}:</span>
                <button
                  onClick={() => handleToggleApprove('B')}
                  className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                    activeRequest.approvedB ? 'bg-emerald-600 text-white shadow-md' : 'bg-white/10 hover:bg-emerald-600/50 text-slate-200'
                  }`}
                >
                  <FontAwesomeIcon icon={faUserCheck} className="mr-1" />
                  {activeRequest.approvedB ? '✓ Setuju' : 'Klik Setuju'}
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
            >
              Batalkan Pengajuan Tukar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}