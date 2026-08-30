import React, { useState, useEffect } from 'react';
import { db, ref, remove, update, onValue } from '../firebase';
import { useToast } from '../context/ToastContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarCheck, 
  faUserShield, 
  faExchangeAlt, 
  faTasks, 
  faClipboardList, 
  faInfoCircle, 
  faTimes,
  faHourglassHalf,
  faExclamationTriangle,
  faGlobe,
  faUser,
  faMapMarkerAlt,
  faCalendarAlt,
  faClock,
  faTrashAlt,
  faEdit,
  faShieldAlt,
  faSave,
  faBullhorn,
  faStickyNote
} from '@fortawesome/free-solid-svg-icons';

export default function Dashboard({ 
  todayPiket = [], 
  todayAgenda = [], 
  agendas = [],
  swapLogs = [], 
  tasks = [], 
  staffList = [], 
  config = {}, 
  isAdmin = false 
}) {
  const { showToast } = useToast();
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [editLogModalOpen, setEditLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState(null);

  // Tab Filter Agenda: 'today' | 'upcoming3'
  const [agendaTab, setAgendaTab] = useState('today');

  // -------------------------------------------------------------
  // STATE PENGUMUMAN & CATATAN SDM (REALTIME DISPLAY)
  // -------------------------------------------------------------
  const [infoList, setInfoList] = useState([]);
  const [notesList, setNotesList] = useState([]);

  useEffect(() => {
    const infoRef = ref(db, 'infoList');
    const unsubscribe = onValue(infoRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setInfoList(list.reverse());
      } else {
        setInfoList([]);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const notesRef = ref(db, 'dashboardNotes');
    const unsubscribe = onValue(notesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.entries(data).map(([id, val]) => ({ id, ...val }));
        setNotesList(list.reverse());
      } else {
        setNotesList([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const getStaffName = (id) => {
    const found = staffList.find((s) => (typeof s === 'object' ? s.id === id || s.name === id || s.NAMA === id : s === id));
    if (found) return typeof found === 'object' ? found.name || found.NAMA || found.nama || found.id : found;
    return id;
  };

  const getTargetText = (task) => {
    if (task.targetType === 'all') return 'Seluruh SDM';
    if (task.targetType === 'specific') return `${getStaffName(task.assignee)}`;
    if (task.targetType === 'kecamatan') return `Kec. ${task.kecamatan || '-'}`;
    return 'SDM Terkait';
  };

  // -------------------------------------------------------------
  // REAL-TIME CLOCK ENGINE & TANGGAL
  // -------------------------------------------------------------
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dateObj = new Date(nowTimestamp);
  const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const namaBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const currentDayName = namaHari[dateObj.getDay()];
  const currentDayNum = dateObj.getDate();
  const currentMonthName = namaBulan[dateObj.getMonth()];
  const currentYear = dateObj.getFullYear();
  const fullFormattedDate = `${currentDayName}, ${currentDayNum} ${currentMonthName} ${currentYear}`;

  const hoursStr = String(dateObj.getHours()).padStart(2, '0');
  const minutesStr = String(dateObj.getMinutes()).padStart(2, '0');
  const secondsStr = String(dateObj.getSeconds()).padStart(2, '0');

  // Format Standar Hari dan Tanggal
  const formatIndoDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return `${namaHari[d.getDay()]}, ${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Helper Sinkronisasi Zona Waktu Lokal
  const getLocalFormat = (input) => {
    if (!input) return { dateStr: '', timeStr: '23:59' };
    if (!input.includes('T')) return { dateStr: input, timeStr: '23:59' };
    
    const d = new Date(input);
    if (isNaN(d.getTime())) return { dateStr: input.split('T')[0], timeStr: '23:59' };
    
    const pad = (n) => String(n).padStart(2, '0');
    return {
      dateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  };

  // -------------------------------------------------------------
  // GROUPING LOGIC: DEADLINE & AGENDA DALAM SATU CARD (BY DATE)
  // -------------------------------------------------------------
  const combinedItems = [];
  const todayDateString = `${currentYear}-${String(currentDayNum).padStart(2,'0')}-${String(dateObj.getMonth()+1).padStart(2,'0')}`; // YYYY-DD-MM bug fix -> YYYY-MM-DD format:
  const todayStr = `${currentYear}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(currentDayNum).padStart(2,'0')}`;

  // 1. Ekstrak Data Tugas
  tasks.forEach(task => {
    const rawDate = task.dueDateTime || task.deadline || task.dueDate || '';
    const { dateStr, timeStr } = getLocalFormat(rawDate);
    combinedItems.push({
      ...task,
      itemType: 'task',
      sortDate: dateStr,
      sortTime: timeStr,
      timestamp: new Date(`${dateStr}T${timeStr.length === 5 ? timeStr + ':00' : timeStr}`).getTime()
    });
  });

  // 2. Ekstrak Data Agenda (Hanya Hari Ini & Mendatang)
  agendas.forEach(ag => {
    const rawDate = ag.date || '';
    const { dateStr, timeStr } = getLocalFormat(rawDate);
    if (dateStr >= todayStr) {
      const fixedTime = ag.time || timeStr;
      combinedItems.push({
        ...ag,
        itemType: 'agenda',
        sortDate: dateStr,
        sortTime: fixedTime,
        timestamp: new Date(`${dateStr}T${fixedTime.length === 5 ? fixedTime + ':00' : fixedTime}`).getTime()
      });
    }
  });

  // Sort berdasarkan jam
  combinedItems.sort((a, b) => a.timestamp - b.timestamp);

  // Group berdasarkan Tanggal
  const groupedItems = {};
  combinedItems.forEach(item => {
    if (!groupedItems[item.sortDate]) groupedItems[item.sortDate] = [];
    groupedItems[item.sortDate].push(item);
  });
  
  const sortedDates = Object.keys(groupedItems).sort((a,b) => new Date(a) - new Date(b));

  // Calculation Countdown Engine Terpusat
  const getCountdown = (targetTime) => {
    const diff = targetTime - nowTimestamp;

    if (isNaN(targetTime)) {
      return { isExpired: true, badgeClass: 'bg-slate-800 border-slate-700' };
    }

    if (diff <= 0) {
      return {
        isExpired: true,
        days: 0, hours: 0, minutes: 0, seconds: 0,
        badgeClass: 'bg-rose-950/90 border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let badgeClass = 'bg-slate-900/90 border-slate-600 shadow-[0_0_15px_rgba(0,0,0,0.5)] text-slate-200';
    if (days === 0 && hours < 24) {
      badgeClass = 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.4)]';
    }

    return {
      isExpired: false,
      days, hours, minutes, seconds,
      badgeClass
    };
  };

  // -------------------------------------------------------------
  // AGENDA 3 HARI KERJA (Untuk Card Status Minimalis)
  // -------------------------------------------------------------
  const getNext3WorkingDays = (startDate) => {
    const dates = [];
    let curr = new Date(startDate);
    while (dates.length < 3) {
      curr.setDate(curr.getDate() + 1);
      const day = curr.getDay();
      if (day !== 0 && day !== 6) { 
        const yr = curr.getFullYear();
        const mo = String(curr.getMonth() + 1).padStart(2, '0');
        const da = String(curr.getDate()).padStart(2, '0');
        dates.push(`${yr}-${mo}-${da}`);
      }
    }
    return dates;
  };

  const next3WorkingDates = getNext3WorkingDays(nowTimestamp);
  const upcoming3DaysAgendaList = agendas.filter((ag) => {
    if (!ag.date) return false;
    const cleanDate = ag.date.includes('T') ? ag.date.split('T')[0] : ag.date;
    return next3WorkingDates.includes(cleanDate);
  });

  // -------------------------------------------------------------
  // HANDLERS HAPUS / EDIT LOG & PENGUMUMAN
  // -------------------------------------------------------------
  const handleDeleteInfo = async (infoId) => {
    if (!isAdmin) return showToast?.('Akses khusus Admin!', 'error');
    if (window.confirm('Hapus pengumuman ini dari dashboard?')) {
      try {
        await remove(ref(db, `infoList/${infoId}`));
        showToast?.('Pengumuman berhasil dihapus!', 'info');
      } catch (err) {
        showToast?.('Gagal menghapus pengumuman.', 'error');
      }
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!isAdmin) return showToast?.('Akses khusus Admin!', 'error');
    if (window.confirm('Hapus catatan ini dari dashboard?')) {
      try {
        await remove(ref(db, `dashboardNotes/${noteId}`));
        showToast?.('Catatan berhasil dihapus!', 'info');
      } catch (err) {
        showToast?.('Gagal menghapus catatan.', 'error');
      }
    }
  };

  const handleDeleteSingleLog = async (logId) => {
    if (!isAdmin) return showToast?.('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('Apakah Anda yakin ingin menghapus riwayat pertukaran ini?')) {
      try {
        await remove(ref(db, `swaps/${logId}`));
        showToast?.('Log pertukaran berhasil dihapus!', 'success');
      } catch (err) {
        showToast?.('Gagal menghapus log.', 'error');
      }
    }
  };

  const handleClearAllLogs = async () => {
    if (!isAdmin) return showToast?.('Akses terbatas khusus Admin!', 'error');
    if (window.confirm('PERHATIAN! Apakah Anda yakin ingin MENGHAPUS SELURUH riwayat pertukaran piket?')) {
      try {
        await remove(ref(db, 'swaps'));
        showToast?.('Seluruh log pertukaran berhasil dibersihkan!', 'success');
      } catch (err) {
        showToast?.('Gagal membersihkan log.', 'error');
      }
    }
  };

  const handleOpenEditLog = (log) => {
    if (!isAdmin) return showToast?.('Akses terbatas khusus Admin!', 'error');
    setEditingLog({ ...log });
    setEditLogModalOpen(true);
  };

  const handleSaveEditedLog = async (e) => {
    e.preventDefault();
    if (!editingLog || !editingLog.id) return;
    try {
      await update(ref(db, `swaps/${editingLog.id}`), {
        staffA: editingLog.staffA,
        dayNumberA: Number(editingLog.dayNumberA),
        staffB: editingLog.staffB,
        dayNumberB: Number(editingLog.dayNumberB)
      });
      showToast?.('Riwayat log berhasil diperbarui!', 'success');
      setEditLogModalOpen(false);
      setEditingLog(null);
    } catch (err) {
      showToast?.('Gagal memperbarui log.', 'error');
    }
  };

  const validSwapLogs = swapLogs.filter(log => log && (log.staffA || log.staffB || log.dayNumberA));

  const defaultNotes = [
    "Hadir 15 menit sebelum jam kerja kantor dimulai.",
    "Memastikan kebersihan dan kerapihan ruang pelayanan & sekretariat.",
    "Mengisi serta mengelola Buku Register Tamu / KPM PKH.",
    "Melayani konsultasi KPM PKH dengan ramah dan profesional.",
    "Memastikan seluruh peralatan listrik, AC, komputer, dan pintu terkunci rapat saat jam pelayanan selesai."
  ];

  const piketNotes = (config.piketNotes && config.piketNotes.length > 0) ? config.piketNotes : defaultNotes;

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full pb-10">
      
      {/* ------------------------------------------------------------- */}
      {/* HEADER WIDGET JAM DIGITAL 3D */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-950/90 via-slate-900/95 to-purple-950/90 border border-indigo-500/40 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden transition-all duration-300 hover:border-indigo-400/60">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

        <div className="z-10 space-y-1.5 max-w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <FontAwesomeIcon icon={faShieldAlt} /> SDM PKH TAPIN
            </span>
            {isAdmin && (
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider">
                Mode Admin Full Akses
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide drop-shadow-md flex items-center gap-2.5 leading-snug">
            <span>Sistem Informasi SDM PKH Tapin</span>
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/80 leading-tight">
            Monitoring Piket, Agenda, & Deadline Tugas Terpadu
          </p>
        </div>

        <div className="z-10 flex items-center gap-3 flex-wrap w-full md:w-auto">
          <div className="p-3.5 sm:p-5 rounded-2xl bg-slate-950/80 border border-indigo-500/40 backdrop-blur-2xl shadow-[0_10px_30px_rgba(99,102,241,0.25)] flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 hover:border-cyan-400/60 transition-all duration-300 w-full sm:w-auto">
            <div className="flex flex-col items-start justify-center px-3 py-1.5 bg-indigo-600/20 rounded-xl border border-indigo-400/30 w-full sm:w-auto">
              <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide flex items-center gap-1.5">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-cyan-400" />
                <span>{fullFormattedDate}</span>
              </span>
            </div>

            <div className="hidden sm:block w-px h-10 bg-white/10"></div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-slate-400 font-bold mb-0.5">
                <FontAwesomeIcon icon={faClock} className="text-cyan-400 animate-pulse" />
                <span>WAKTU REAL-TIME</span>
              </div>
              <div className="font-mono text-xl sm:text-3xl font-black text-white tracking-wider flex items-center drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
                <span>{hoursStr}:{minutesStr}</span>
                <span className="text-cyan-400 text-base sm:text-2xl font-extrabold animate-pulse ml-1">: {secondsStr} WITA</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsNotesModalOpen(true)}
            className="w-full sm:w-auto px-4 py-3 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/35 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all duration-300 cursor-pointer shadow-lg shadow-amber-500/10 active:scale-95"
          >
            <FontAwesomeIcon icon={faClipboardList} />
            <span>Petunjuk Piket</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECTION UTAMA: JADWAL & DEADLINE TERPADU (GROUPED BY DATE) */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-5 sm:space-y-6 relative mt-10">
        <div className="absolute -inset-1 bg-gradient-to-r from-rose-500/10 via-indigo-500/10 to-cyan-500/10 rounded-3xl blur-xl pointer-events-none"></div>
        <div className="flex items-center gap-3 text-white relative z-10 px-2 border-b border-white/10 pb-4">
          <FontAwesomeIcon icon={faTasks} className="text-2xl sm:text-3xl text-rose-400 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]" />
          <h2 className="text-xl sm:text-3xl font-black tracking-wide drop-shadow-lg uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400">
            Jadwal Kegiatan & Deadline Tugas Terpadu
          </h2>
        </div>

        <div className="space-y-8 relative z-10">
          {sortedDates.length > 0 ? (
            sortedDates.map(dateStr => {
              const items = groupedItems[dateStr];
              return (
                <div key={dateStr} className="p-1 rounded-3xl bg-gradient-to-br from-slate-800/90 to-slate-900/95 border border-slate-600/50 shadow-2xl overflow-hidden transition-all duration-300 relative group/card hover:border-slate-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

                  <div className="p-4 sm:p-6 bg-slate-950/60 rounded-[22px] backdrop-blur-md">
                    {/* --- HEADER TANGGAL CARD --- */}
                    <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-700/60">
                      <div className="bg-indigo-500/20 w-14 h-14 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner border border-indigo-500/30">
                        <FontAwesomeIcon icon={faCalendarCheck} className="text-3xl" />
                      </div>
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white tracking-wide uppercase drop-shadow-md">
                          {formatIndoDate(dateStr)}
                        </h3>
                        <div className="flex items-center gap-3 mt-1.5 text-xs font-bold">
                          <span className="text-rose-400 bg-rose-950/50 px-2 py-0.5 rounded-md border border-rose-500/20">
                            {items.filter(i => i.itemType === 'task').length} Tugas
                          </span>
                          <span className="text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-500/20">
                            {items.filter(i => i.itemType === 'agenda').length} Agenda
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* --- ISI LIST CARD --- */}
                    <div className="space-y-4 sm:space-y-5">
                      {items.map((item, idx) => {
                        
                        if (item.itemType === 'task') {
                          // ==========================================
                          // UI TUGAS / DEADLINE (MERAH - ROSE)
                          // ==========================================
                          const countdown = getCountdown(item.timestamp);
                          return (
                            <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950/40 to-slate-900/70 border-l-[6px] border-l-rose-500 border border-rose-500/20 hover:from-rose-900/50 transition-all duration-300 shadow-lg relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>

                              <div className="flex-1 space-y-2.5 z-10">
                                <span className="inline-flex items-center justify-center px-3 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-black tracking-widest rounded uppercase border border-rose-500/40 shadow-[0_0_12px_rgba(244,63,94,0.3)]">
                                  🔴 DEADLINE TUGAS
                                </span>
                                <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide leading-snug drop-shadow-sm">
                                  {item.title}
                                </h4>
                                <div className="flex flex-wrap gap-3 text-xs pt-1">
                                  <span className="text-slate-200 font-bold bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center gap-2">
                                    <FontAwesomeIcon icon={faUser} className="text-slate-400"/>
                                    {getTargetText(item)}
                                  </span>
                                </div>
                              </div>

                              <div className="md:w-auto w-full flex items-center justify-start md:justify-end z-10 shrink-0">
                                 <div className={`p-4 sm:p-5 rounded-2xl border-[3px] flex flex-col items-center justify-center min-w-[190px] shadow-2xl backdrop-blur-md ${countdown.badgeClass}`}>
                                   <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase flex items-center gap-2 mb-1.5 opacity-90 text-white">
                                     <FontAwesomeIcon icon={countdown.isExpired ? faExclamationTriangle : faHourglassHalf} className={countdown.isExpired ? 'animate-bounce text-rose-400 text-sm' : 'animate-spin-slow text-amber-400 text-sm'} />
                                     <span>Batas Akhir Waktu</span>
                                   </span>
                                   {countdown.isExpired ? (
                                     <span className="font-black text-xl sm:text-2xl uppercase tracking-widest text-rose-400 animate-pulse drop-shadow-[0_0_15px_rgba(244,63,94,1)]">TERLEWATI</span>
                                   ) : (
                                     <div className="font-mono font-black text-2xl sm:text-3xl flex items-baseline gap-1.5 drop-shadow-lg text-white">
                                       {countdown.days > 0 && <span className="text-rose-300">{countdown.days}<span className="text-xs ml-1 font-bold text-slate-300">H</span></span>}
                                       <span className="text-amber-300">{String(countdown.hours).padStart(2, '0')}<span className="text-xs ml-1 font-bold text-slate-300">J</span></span>
                                       <span className="text-emerald-300">{String(countdown.minutes).padStart(2, '0')}<span className="text-xs ml-1 font-bold text-slate-300">M</span></span>
                                       <span className="text-cyan-300 animate-pulse">{String(countdown.seconds).padStart(2, '0')}<span className="text-xs ml-1 font-bold text-slate-300">D</span></span>
                                     </div>
                                   )}
                                   <div className="mt-2 text-[10px] font-bold text-slate-400 tracking-wider">
                                     Jam: <span className="text-rose-300">{item.sortTime} WITA</span>
                                   </div>
                                 </div>
                              </div>
                            </div>
                          )
                        } else {
                          // ==========================================
                          // UI AGENDA / KEGIATAN (BIRU - CYAN)
                          // ==========================================
                          return (
                            <div key={idx} className="flex flex-col md:flex-row gap-4 p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-slate-900/70 border-l-[6px] border-l-cyan-500 border border-cyan-500/20 hover:from-cyan-900/50 transition-all duration-300 shadow-lg relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

                              <div className="flex-1 space-y-2.5 z-10">
                                <span className="inline-flex items-center justify-center px-3 py-1 bg-cyan-500/20 text-cyan-300 text-[10px] font-black tracking-widest rounded uppercase border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                                  🔵 AGENDA KEGIATAN
                                </span>
                                <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide leading-snug drop-shadow-sm">
                                  {item.title}
                                </h4>
                                <div className="flex flex-wrap gap-3 text-xs pt-1">
                                  <span className="text-slate-200 font-bold bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center gap-2">
                                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-cyan-400"/>
                                    Desa {item.desa}, Kec. {item.kecamatan}
                                  </span>
                                  {item.sdmName && (
                                    <span className="text-emerald-200 font-bold bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/30 shadow-sm flex items-center gap-2">
                                      <FontAwesomeIcon icon={faUser} className="text-emerald-400"/>
                                      {item.sdmName}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="md:w-auto w-full flex items-center justify-start md:justify-end z-10 shrink-0">
                                 <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border-[3px] border-cyan-500/40 text-cyan-300 flex flex-col items-center justify-center min-w-[190px] shadow-[0_0_20px_rgba(6,182,212,0.15)] backdrop-blur-md">
                                    <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase flex items-center gap-2 mb-2 opacity-90 text-white">
                                      <FontAwesomeIcon icon={faCalendarCheck} className="text-cyan-400 text-sm" />
                                      <span>Jadwal Pelaksanaan</span>
                                    </span>
                                    <div className="font-mono font-black text-2xl sm:text-3xl flex items-center gap-2.5 drop-shadow-lg text-white">
                                      <FontAwesomeIcon icon={faClock} className="animate-pulse text-cyan-400 text-xl" />
                                      <span>{item.sortTime}</span>
                                    </div>
                                    <div className="mt-1 text-[11px] font-bold text-cyan-400 tracking-widest">
                                      WITA
                                    </div>
                                 </div>
                              </div>
                            </div>
                          )
                        }
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-center py-16 text-slate-400 italic text-sm border-2 border-dashed border-slate-600/50 rounded-[32px] bg-slate-900/30 shadow-inner">
              <div className="mb-3">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-4xl text-slate-600" />
              </div>
              Belum ada tugas atau agenda krusial yang aktif saat ini.
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DUAL SECTION: PAPAN PENGUMUMAN & PAPAN CATATAN SDM */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 pt-6 border-t border-white/10 mt-6">
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-400">
              <FontAwesomeIcon icon={faBullhorn} className="text-lg sm:text-xl" />
              <h2 className="text-sm sm:text-lg font-bold text-white">Papan Pengumuman SDM</h2>
            </div>
            <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-2.5 py-1 rounded-full border border-amber-500/30">
              {infoList.length} Pengumuman
            </span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {infoList.length > 0 ? (
              infoList.map((info) => (
                <div key={info.id} className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-white/10 relative group hover:border-amber-500/40 transition-all">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-bold text-amber-300 text-xs break-words">{info.title}</span>
                    <span className="text-[9px] text-slate-400 shrink-0">{info.dateStr || '-'}</span>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{info.content}</p>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteInfo(info.id)}
                      className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-500 py-6 italic">Belum ada pengumuman diterbitkan.</p>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <FontAwesomeIcon icon={faStickyNote} className="text-lg sm:text-xl" />
              <h2 className="text-sm sm:text-lg font-bold text-white">Catatan Operasional SDM</h2>
            </div>
            <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-500/30">
              {notesList.length} Catatan
            </span>
          </div>

          <div className="space-y-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar">
            {notesList.length > 0 ? (
              notesList.map((note) => (
                <div key={note.id} className="p-3.5 sm:p-4 rounded-2xl bg-slate-950/80 border border-white/10 relative group hover:border-indigo-500/40 transition-all">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <span className="font-bold text-indigo-300 text-xs break-words">{note.title}</span>
                    <span className="text-[9px] text-slate-400 shrink-0">{note.dateStr || '-'}</span>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">{note.content}</p>
                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="mt-2 text-[10px] text-rose-400 hover:text-rose-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <FontAwesomeIcon icon={faTrashAlt} />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-500 py-6 italic">Belum ada catatan operasional ditambahkan.</p>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* STATUS CARDS MINIMALIS (PIKET, AGENDA KECIL, & SWAP) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-emerald-500/30 backdrop-blur-xl shadow-3d-glass hover:-translate-y-1 transition-all duration-300 flex flex-col h-full max-h-80 hover:border-emerald-400/60">
          <div className="flex items-center gap-2.5 mb-3 sm:mb-4 text-emerald-400 shrink-0">
            <FontAwesomeIcon icon={faUserShield} className="text-lg sm:text-xl" />
            <h3 className="font-bold text-base sm:text-lg text-white">Piket Hari Ini</h3>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {todayPiket.length > 0 ? (
              todayPiket.map((p, idx) => (
                <div key={idx} className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 flex justify-between items-center hover:bg-emerald-500/10 transition-colors">
                  <span className="font-semibold text-slate-100 text-xs sm:text-sm truncate">{getStaffName(p)}</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399] shrink-0"></span>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full py-6 sm:py-0">
                <p className="text-xs sm:text-sm text-slate-400 italic">Tidak ada jadwal piket aktif hari ini.</p>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-cyan-500/30 backdrop-blur-xl shadow-3d-glass hover:-translate-y-1 transition-all duration-300 flex flex-col h-full max-h-80 hover:border-cyan-400/60">
          <div className="flex items-center justify-between mb-3 sm:mb-4 shrink-0 flex-wrap gap-2">
            <div className="flex items-center gap-2 text-cyan-400">
              <FontAwesomeIcon icon={faCalendarCheck} className="text-base sm:text-lg" />
              <h3 className="font-bold text-sm sm:text-base text-white">Agenda SDM</h3>
            </div>
            <div className="flex bg-slate-950 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setAgendaTab('today')}
                className={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                  agendaTab === 'today' ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Hari Ini ({todayAgenda.length})
              </button>
              <button
                onClick={() => setAgendaTab('upcoming3')}
                className={`px-2 py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all cursor-pointer ${
                  agendaTab === 'upcoming3' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                3 Hari Kerja ({upcoming3DaysAgendaList.length})
              </button>
            </div>
          </div>
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {agendaTab === 'today' ? (
              todayAgenda.length > 0 ? (
                todayAgenda.map((ag, idx) => (
                  <div key={idx} className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-cyan-500/10 transition-colors">
                    <span className="font-bold text-cyan-200 block text-xs sm:text-sm break-words">{ag.title}</span>
                    <span className="text-[10px] sm:text-[11px] text-slate-300 block mt-1">
                      📍 Desa {ag.desa}, Kec. {ag.kecamatan} | ⏰ {ag.time}
                    </span>
                    {ag.sdmName && (
                      <span className="text-[10px] text-emerald-300 font-semibold block mt-0.5">
                        👤 SDM: {ag.sdmName}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full py-6 sm:py-0">
                  <p className="text-xs text-slate-400 italic">Belum ada agenda terdaftar hari ini.</p>
                </div>
              )
            ) : (
              upcoming3DaysAgendaList.length > 0 ? (
                upcoming3DaysAgendaList.map((ag, idx) => (
                  <div key={idx} className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-indigo-500/20 hover:bg-indigo-500/10 transition-colors">
                    <div className="flex justify-between items-center mb-1 gap-1">
                      <span className="font-bold text-indigo-200 block text-xs truncate flex-1">{ag.title}</span>
                      <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0">
                        {ag.date}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-300 block">
                      📍 Desa {ag.desa}, Kec. {ag.kecamatan} | ⏰ {ag.time}
                    </span>
                    {ag.sdmName && (
                      <span className="text-[10px] text-emerald-300 font-semibold block mt-0.5">
                        👤 SDM: {ag.sdmName}
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center h-full py-6 sm:py-0">
                  <p className="text-xs text-slate-400 italic">Tidak ada agenda pada 3 hari kerja ke depan.</p>
                </div>
              )
            )}
          </div>
        </div>

        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-purple-500/30 backdrop-blur-xl shadow-3d-glass hover:-translate-y-1 transition-all duration-300 flex flex-col h-full max-h-80 hover:border-purple-400/60">
          <div className="flex items-center justify-between mb-3 sm:mb-4 shrink-0">
            <div className="flex items-center gap-2.5 text-purple-400">
              <FontAwesomeIcon icon={faExchangeAlt} className="text-lg sm:text-xl" />
              <h3 className="font-bold text-base sm:text-lg text-white">Laporan Pertukaran Piket</h3>
            </div>
            {isAdmin && validSwapLogs.length > 0 && (
              <button
                onClick={handleClearAllLogs}
                className="px-2 py-1 rounded-xl bg-rose-600/30 border border-rose-500/50 hover:bg-rose-600 text-rose-300 hover:text-white text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shrink-0"
                title="Hapus Semua Log Pertukaran"
              >
                <FontAwesomeIcon icon={faTrashAlt} />
                <span>Hapus</span>
              </button>
            )}
          </div>
          <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
            {validSwapLogs.length > 0 ? (
              validSwapLogs.map((log, idx) => (
                <div key={log.id || idx} className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 text-xs text-slate-300 space-y-1 relative group hover:bg-purple-500/10 transition-colors">
                  <div className="font-bold text-purple-300 flex items-center justify-between gap-1 leading-tight">
                    <span className="truncate flex-1">{getStaffName(log.staffA)} {log.dayNumberA ? `(Tgl ${log.dayNumberA})` : ''}</span>
                    <span className="text-amber-400 px-0.5 shrink-0">⇄</span>
                    <span className="truncate flex-1 text-right">{getStaffName(log.staffB)} {log.dayNumberB ? `(Tgl ${log.dayNumberB})` : ''}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <p className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold truncate">✓ Resmi Bertukar</p>
                    {isAdmin && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => handleOpenEditLog(log)} className="text-slate-400 hover:text-cyan-400 text-xs p-1 transition-colors cursor-pointer"><FontAwesomeIcon icon={faEdit} /></button>
                        <button onClick={() => handleDeleteSingleLog(log.id)} className="text-slate-400 hover:text-rose-400 text-xs p-1 transition-colors cursor-pointer"><FontAwesomeIcon icon={faTrashAlt} /></button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full py-6 sm:py-0">
                <p className="text-xs text-slate-400 italic">Belum ada riwayat pertukaran piket.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL COMPONENTS TETAP UTUH */}
      {/* ------------------------------------------------------------- */}
      {editLogModalOpen && editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md p-5 sm:p-7 rounded-3xl bg-slate-900 border border-purple-500/50 shadow-2xl relative space-y-4 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => { setEditLogModalOpen(false); setEditingLog(null); }} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"><FontAwesomeIcon icon={faTimes} /></button>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2"><FontAwesomeIcon icon={faEdit} className="text-purple-400" /><span>Edit Riwayat Pertukaran Piket</span></h3>
            <form onSubmit={handleSaveEditedLog} className="space-y-4">
              <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-indigo-300 block">Pihak Pertama (SDM A)</span>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Nama SDM A</label>
                  <select value={editingLog.staffA || ''} onChange={(e) => setEditingLog({ ...editingLog, staffA: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none"><option value="">-- Pilih SDM --</option>{staffList.map((s) => { const sId = typeof s === 'object' ? s.id || s.name : s; const sName = typeof s === 'object' ? s.name || s.NAMA || s.id : s; return <option key={sId} value={sId}>{sName}</option>; })}</select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Tanggal Piket SDM A</label>
                  <input type="number" value={editingLog.dayNumberA || ''} onChange={(e) => setEditingLog({ ...editingLog, dayNumberA: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none" />
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-cyan-300 block">Pihak Kedua (SDM B)</span>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Nama SDM B</label>
                  <select value={editingLog.staffB || ''} onChange={(e) => setEditingLog({ ...editingLog, staffB: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none"><option value="">-- Pilih SDM --</option>{staffList.map((s) => { const sId = typeof s === 'object' ? s.id || s.name : s; const sName = typeof s === 'object' ? s.name || s.NAMA || s.id : s; return <option key={sId} value={sId}>{sName}</option>; })}</select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Tanggal Piket SDM B</label>
                  <input type="number" value={editingLog.dayNumberB || ''} onChange={(e) => setEditingLog({ ...editingLog, dayNumberB: e.target.value })} className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setEditLogModalOpen(false); setEditingLog(null); }} className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer">Batal</button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"><FontAwesomeIcon icon={faSave} /><span>Simpan Perubahan</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isNotesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg p-5 sm:p-8 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-3d-glass relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsNotesModalOpen(false)} className="absolute top-5 right-5 text-slate-400 hover:text-white cursor-pointer"><FontAwesomeIcon icon={faTimes} /></button>
            <div className="flex items-center gap-2.5 mb-5 text-amber-400"><FontAwesomeIcon icon={faInfoCircle} className="text-xl sm:text-2xl" /><h3 className="text-base sm:text-xl font-bold text-white">Standar Operasional Tugas Piket</h3></div>
            <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
              {piketNotes.map((note, idx) => (
                <div key={idx} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 text-xs text-slate-200">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                  <span className="leading-relaxed">{note}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setIsNotesModalOpen(false)} className="w-full mt-5 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs sm:text-sm shadow-3d-button transition-all cursor-pointer active:scale-95">Saya Mengerti</button>
          </div>
        </div>
      )}
    </div>
  );
}
