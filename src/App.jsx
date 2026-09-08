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
  faStickyNote,
  faExclamationCircle,
  faCheckCircle,
  faListAlt,
  faMapMarkedAlt,
  faHome
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

  // Filter & Sub-Menu Tabs
  const [agendaTab, setAgendaTab] = useState('today');
  const [mainMenuTab, setMainMenuTab] = useState('ringkasan'); // 'ringkasan' | 'lokasi' | 'papan'

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
  // REAL-TIME CLOCK ENGINE & TANGGAL (WITA +8)
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

  const formatIndoDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(`${dateStr}T00:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return `${namaHari[d.getDay()]}, ${d.getDate()} ${namaBulan[d.getMonth()]} ${d.getFullYear()}`;
  };

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
  const todayStr = `${currentYear}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(currentDayNum).padStart(2,'0')}`;

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

  combinedItems.sort((a, b) => a.timestamp - b.timestamp);

  const groupedItems = {};
  combinedItems.forEach(item => {
    if (item.timestamp <= nowTimestamp) return; // Hide completed/past tasks
    if (!groupedItems[item.sortDate]) groupedItems[item.sortDate] = [];
    groupedItems[item.sortDate].push(item);
  });
  
  const sortedDates = Object.keys(groupedItems).sort((a,b) => new Date(a) - new Date(b));
  const todayItems = groupedItems[todayStr] || [];

  const getCountdown = (targetTime) => {
    const diff = targetTime - nowTimestamp;
    if (isNaN(targetTime)) return { isExpired: true, badgeClass: 'bg-slate-900 border-slate-700 text-slate-400' };

    if (diff <= 0) {
      return {
        isExpired: true,
        days: 0, hours: 0, minutes: 0, seconds: 0,
        badgeClass: 'bg-rose-950/80 border-rose-500 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let badgeClass = 'bg-slate-900 border-slate-700 shadow-lg text-slate-200';
    if (days === 0 && hours < 24) {
      badgeClass = 'bg-rose-950/40 border-rose-500/50 text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.3)]';
    } else if (days <= 2) {
      badgeClass = 'bg-amber-950/40 border-amber-500/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.2)]';
    }

    return {
      isExpired: false,
      days, hours, minutes, seconds,
      badgeClass
    };
  };

  // -------------------------------------------------------------
  // AGENDA 3 HARI KERJA & AGENDA HARI INI 
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

  const activeTodayAgenda = todayAgenda.filter(ag => {
    const { dateStr, timeStr } = getLocalFormat(ag.date || '');
    const tStr = ag.time || timeStr || '23:59';
    const ts = new Date(`${dateStr || todayStr}T${tStr.length === 5 ? tStr + ':00' : tStr}`).getTime();
    return ts > nowTimestamp;
  });

  const activeUpcomingAgenda = upcoming3DaysAgendaList.filter(ag => {
    const { dateStr, timeStr } = getLocalFormat(ag.date || '');
    const tStr = ag.time || timeStr || '23:59';
    const ts = new Date(`${dateStr || todayStr}T${tStr.length === 5 ? tStr + ':00' : tStr}`).getTime();
    return ts > nowTimestamp;
  });

  // -------------------------------------------------------------
  // MESIN KEBERADAAN SDM REAL-TIME BERDASARKAN AGENDA & JABATAN
  // -------------------------------------------------------------
  const keberadaanList = staffList.map(staff => {
    const staffName = typeof staff === 'object' ? (staff.name || staff.NAMA || staff.nama) : String(staff);
    const staffRole = typeof staff === 'object' ? (staff.jabatan || staff.JABATAN || staff.role) : '';
    const staffId = typeof staff === 'object' ? (staff.id || staff.nik) : staffName;

    const sdmAgenda = activeTodayAgenda.find(ag =>
      (ag.sdmName && ag.sdmName.toLowerCase().includes(staffName.toLowerCase())) ||
      (ag.staffId && ag.staffId === staffId) ||
      (ag.assignee && ag.assignee === staffId) ||
      (ag.title && ag.title.toLowerCase().includes(staffName.toLowerCase()))
    );

    let location = "Lapangan";
    let statusText = "Tidak Ada Agenda / Standby";
    let isKetuaTim = false;

    if (staffRole && (staffRole.toLowerCase().includes('ketua tim') || staffRole.toLowerCase().includes('koordinator'))) {
      isKetuaTim = true;
    }
    
    if (staffName.toLowerCase().includes('zaen syachrullah')) {
      isKetuaTim = true;
    }

    if (sdmAgenda) {
      if (sdmAgenda.desa) {
         location = `Desa ${sdmAgenda.desa}`;
         if (sdmAgenda.kecamatan) location += `, Kec. ${sdmAgenda.kecamatan}`;
      } else if (sdmAgenda.lokasi || sdmAgenda.location) {
         location = sdmAgenda.lokasi || sdmAgenda.location;
      } else {
         location = "Lokasi Agenda";
      }
      statusText = sdmAgenda.title || "Pelaksanaan Agenda/Supervisi";
    } else {
      if (isKetuaTim) {
        location = "Sekretariat PKH";
        statusText = "Koordinasi / Standby Sekretariat";
      }
    }

    return {
      id: staffId,
      name: staffName,
      role: staffRole || (isKetuaTim ? 'Ketua Tim Kabupaten' : 'SDM PKH'),
      location,
      statusText,
      hasAgenda: !!sdmAgenda
    };
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

  const safeTodayPiket = Array.isArray(todayPiket) 
    ? todayPiket 
    : (todayPiket ? Object.values(todayPiket) : []);

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full pb-10 overflow-hidden text-white font-sans">
      
      {/* HEADER WIDGET JAM DIGITAL 3D (TEMA BIRU MALAM GLOSSY) */}
      <div className="p-4 sm:p-8 rounded-[2rem] bg-gradient-to-br from-[#0B1021] via-[#111827] to-[#0A192F] border border-indigo-500/30 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-b from-white/5 to-transparent pointer-events-none"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-600/20 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-cyan-600/20 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="z-10 space-y-2 max-w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-indigo-900/50 border border-indigo-500/40 text-indigo-300 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-inner">
              <FontAwesomeIcon icon={faShieldAlt} /> SDM PKH TAPIN
            </span>
            {isAdmin && (
              <span className="px-3 py-1 rounded-full bg-emerald-900/50 border border-emerald-500/40 text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider shadow-inner">
                Mode Admin
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-cyan-200 tracking-wide drop-shadow-lg leading-tight break-words">
            Sistem Informasi SDM
          </h1>
          <p className="text-xs sm:text-sm text-indigo-200/70 font-medium tracking-wide">
            Monitoring Piket, Agenda, Lokasi & Tugas Terpadu
          </p>
        </div>

        <div className="z-10 flex items-center gap-3 flex-wrap w-full md:w-auto">
          <div className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-2xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-5 w-full sm:w-auto">
            <div className="flex flex-col items-start justify-center px-4 py-2 bg-indigo-950/40 rounded-xl border border-indigo-500/20 w-full sm:w-auto">
              <span className="text-xs sm:text-sm font-extrabold text-indigo-100 tracking-wide flex items-center gap-2 break-words">
                <FontAwesomeIcon icon={faCalendarAlt} className="text-cyan-400" />
                <span>{fullFormattedDate}</span>
              </span>
            </div>

            <div className="hidden sm:block w-px h-12 bg-white/10"></div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-xs text-indigo-300/80 font-bold mb-1 uppercase tracking-widest">
                <FontAwesomeIcon icon={faClock} className="text-cyan-400 animate-pulse" />
                <span>Waktu Real-Time</span>
              </div>
              <div className="font-mono text-2xl sm:text-4xl font-black text-white tracking-widest flex items-center drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
                <span>{hoursStr}:{minutesStr}</span>
                <span className="text-cyan-400 text-lg sm:text-2xl font-extrabold animate-pulse ml-1.5">: {secondsStr} WITA</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SUB MENU NAVIGASI (TABS) UNTUK SEMUA ORANG */}
      <div className="relative z-20 flex overflow-x-auto custom-scrollbar gap-2 sm:gap-4 py-2 border-b border-white/10 w-full snap-x">
        <button 
          onClick={() => setMainMenuTab('ringkasan')} 
          className={`flex-shrink-0 snap-start px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 shadow-lg cursor-pointer ${
            mainMenuTab === 'ringkasan' 
              ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white border border-cyan-400/50 shadow-[0_0_15px_rgba(6,182,212,0.4)]' 
              : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faTasks} />
          <span>Tugas & Agenda</span>
        </button>
        
        <button 
          onClick={() => setMainMenuTab('lokasi')} 
          className={`flex-shrink-0 snap-start px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 shadow-lg cursor-pointer ${
            mainMenuTab === 'lokasi' 
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.4)]' 
              : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faMapMarkedAlt} className={mainMenuTab === 'lokasi' ? 'animate-bounce' : ''} />
          <span>Lokasi Live SDM</span>
        </button>

        <button 
          onClick={() => setMainMenuTab('papan')} 
          className={`flex-shrink-0 snap-start px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-300 flex items-center gap-2 shadow-lg cursor-pointer ${
            mainMenuTab === 'papan' 
              ? 'bg-gradient-to-r from-amber-600 to-rose-600 text-white border border-amber-400/50 shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
              : 'bg-slate-900/50 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FontAwesomeIcon icon={faBullhorn} />
          <span>Informasi & Operasional</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: RINGKASAN TUGAS & AGENDA                           */}
      {/* ========================================================= */}
      {mainMenuTab === 'ringkasan' && (
        <div className="space-y-8 animate-fadeIn">
          
          {/* TABEL RINCIAN KEGIATAN HARI INI */}
          <div className="space-y-4 pt-2 relative w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faListAlt} className="text-xl sm:text-2xl text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                <h2 className="text-lg sm:text-2xl font-black tracking-wide uppercase drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-emerald-100 to-emerald-400 break-words">
                  Rincian Kegiatan Hari Ini
                </h2>
              </div>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-950/60 px-4 py-2 rounded-xl border border-emerald-500/30 flex items-center gap-2 w-fit shadow-inner">
                <FontAwesomeIcon icon={faCalendarCheck} />
                Total: {todayItems.length} Aktivitas
              </span>
            </div>

            <div className="rounded-[1.5rem] bg-[#0F172A]/80 border border-emerald-500/20 backdrop-blur-xl shadow-2xl overflow-hidden w-full">
              <div className="overflow-x-auto custom-scrollbar w-full">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-emerald-950/40 text-emerald-200 text-[10px] sm:text-xs uppercase tracking-widest border-b border-emerald-500/20">
                      <th className="p-4 sm:p-5 font-extrabold whitespace-nowrap">Judul Kegiatan</th>
                      <th className="p-4 sm:p-5 font-extrabold whitespace-nowrap">Kategori</th>
                      <th className="p-4 sm:p-5 font-extrabold whitespace-nowrap">Waktu Pelaksanaan</th>
                      <th className="p-4 sm:p-5 font-extrabold whitespace-nowrap">Status Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-500/10 text-xs sm:text-sm text-slate-200">
                    {todayItems.length > 0 ? (
                      todayItems.map((item, idx) => {
                        const countdown = getCountdown(item.timestamp);
                        const isTask = item.itemType === 'task';
                        return (
                          <tr key={idx} className="hover:bg-emerald-900/20 transition-colors duration-200 group/row">
                            <td className="p-4 sm:p-5 font-bold break-words min-w-[220px]">
                              <span className={isTask ? "text-rose-100 group-hover/row:text-rose-300" : "text-cyan-100 group-hover/row:text-cyan-300"}>
                                {item.title}
                              </span>
                            </td>
                            <td className="p-4 sm:p-5 whitespace-nowrap align-middle">
                              {isTask ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 text-rose-300 text-[10px] font-black tracking-widest border border-rose-500/30 uppercase">
                                  <FontAwesomeIcon icon={faTasks} /> Deadline
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 text-cyan-300 text-[10px] font-black tracking-widest border border-cyan-500/30 uppercase">
                                  <FontAwesomeIcon icon={faCalendarCheck} /> Agenda
                                </span>
                              )}
                            </td>
                            <td className="p-4 sm:p-5 whitespace-nowrap font-mono font-bold">
                              <span className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-white/5 text-amber-300 flex items-center gap-2 w-fit">
                                <FontAwesomeIcon icon={faClock} className={isTask ? "text-rose-400" : "text-cyan-400"} />
                                {item.sortTime} WITA
                              </span>
                            </td>
                            <td className="p-4 sm:p-5 whitespace-nowrap align-middle">
                              {countdown.isExpired ? (
                                <span className="text-rose-400 font-black text-[10px] sm:text-xs uppercase tracking-wider flex items-center gap-1.5">
                                  <FontAwesomeIcon icon={faTimes} /> Terlewati
                                </span>
                              ) : (
                                <div className="font-mono font-bold text-emerald-300 text-[11px] sm:text-xs flex items-center gap-1.5 bg-emerald-950/40 px-3 py-1.5 rounded-lg w-fit border border-emerald-500/20">
                                  <span className="relative flex h-2 w-2 mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  {countdown.days > 0 && <span className="text-emerald-100">{countdown.days}h</span>}
                                  <span>{String(countdown.hours).padStart(2,'0')}j</span>
                                  <span>{String(countdown.minutes).padStart(2,'0')}m</span>
                                  <span className="text-cyan-300 animate-pulse">{String(countdown.seconds).padStart(2,'0')}d</span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="4" className="p-10 text-center text-emerald-500/50 italic text-xs sm:text-sm bg-emerald-950/10">
                          <FontAwesomeIcon icon={faCheckCircle} className="text-3xl text-emerald-600/50 mb-3 block mx-auto" />
                          Semua agenda atau tugas untuk hari ini sudah selesai/terlewati.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* JADWAL & DEADLINE TERPADU (GROUPED BY DATE) */}
          <div className="space-y-5 relative w-full mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white border-b border-indigo-500/20 pb-4">
              <div className="flex items-center gap-3">
                <FontAwesomeIcon icon={faTasks} className="text-2xl sm:text-3xl text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.6)]" />
                <h2 className="text-xl sm:text-3xl font-black tracking-wide drop-shadow-lg uppercase text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-100 to-cyan-200 break-words">
                  Timeline Kegiatan Aktif
                </h2>
              </div>
            </div>

            <div className="space-y-8 w-full">
              {sortedDates.length > 0 ? (
                sortedDates.map(dateStr => {
                  const items = groupedItems[dateStr];
                  const isToday = dateStr === todayStr;

                  return (
                    <div key={dateStr} className={`p-1 rounded-[2rem] bg-gradient-to-br from-[#0F172A] to-[#0B1021] shadow-2xl overflow-hidden transition-all duration-300 relative group/card border w-full ${isToday ? 'border-indigo-500/40 shadow-[0_0_25px_rgba(99,102,241,0.15)]' : 'border-white/5 hover:border-indigo-500/20'}`}>
                      {isToday && <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none animate-pulse-slow"></div>}

                      <div className="p-4 sm:p-6 bg-[#0B1021]/80 rounded-[1.75rem] backdrop-blur-xl w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
                          <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner border shrink-0 ${isToday ? 'bg-indigo-900/40 text-indigo-300 border-indigo-500/30' : 'bg-slate-900 text-slate-400 border-white/10'}`}>
                              <FontAwesomeIcon icon={faCalendarAlt} className="text-2xl sm:text-3xl" />
                            </div>
                            <div className="min-w-0">
                              <h3 className={`text-lg sm:text-2xl font-black uppercase tracking-wide drop-shadow-md break-words ${isToday ? 'text-indigo-200' : 'text-slate-200'}`}>
                                {formatIndoDate(dateStr)}
                                {isToday && <span className="ml-2 text-[10px] sm:text-xs bg-indigo-600/80 text-white px-2.5 py-1 rounded-full uppercase tracking-widest align-middle border border-indigo-400/50">Hari Ini</span>}
                              </h3>
                              <p className="text-xs text-slate-400 font-medium mt-1 break-words whitespace-normal">Total {items.length} aktivitas terdaftar pada tanggal ini.</p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4 sm:space-y-5 w-full">
                          {items.map((item, idx) => {
                            if (item.itemType === 'task') {
                              const countdown = getCountdown(item.timestamp);
                              return (
                                <div key={idx} className="flex flex-col lg:flex-row p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 to-[#0B1021] border-l-[6px] border-l-rose-500 border-y border-r border-rose-500/10 hover:from-rose-900/30 transition-all duration-300 shadow-lg relative overflow-hidden gap-5 items-stretch w-full">
                                  <div className="flex-1 flex flex-col justify-between z-10 space-y-3 min-w-0">
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 bg-rose-500/20 text-rose-300 text-[10px] font-black tracking-widest rounded-md uppercase border border-rose-500/30 shadow-inner shrink-0">
                                          <FontAwesomeIcon icon={faExclamationCircle} className="mr-1.5" /> DEADLINE TUGAS
                                        </span>
                                      </div>
                                      <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide leading-snug drop-shadow-md break-words whitespace-normal">
                                        {item.title}
                                      </h4>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2.5 text-xs">
                                      <span className="text-slate-200 font-bold bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center gap-2 break-words">
                                        <FontAwesomeIcon icon={faUser} className="text-slate-400"/>
                                        {getTargetText(item)}
                                      </span>
                                      <span className="text-rose-200 font-bold bg-rose-950/80 px-3 py-1.5 rounded-lg border border-rose-500/30 shadow-sm flex items-center gap-2 whitespace-nowrap">
                                        <FontAwesomeIcon icon={faClock} className="text-rose-400"/>
                                        Batas: {item.sortTime} WITA
                                      </span>
                                    </div>
                                  </div>

                                  <div className="lg:w-auto w-full flex flex-col items-center justify-center z-10 shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-5">
                                     <div className="flex items-center gap-2 mb-2">
                                        <div className="relative flex h-2.5 w-2.5">
                                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${countdown.isExpired ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${countdown.isExpired ? 'bg-rose-500' : 'bg-amber-500'}`}></span>
                                        </div>
                                        <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-400">
                                          {countdown.isExpired ? 'STATUS: TERLEWATI' : 'SISA WAKTU DEADLINE'}
                                        </span>
                                     </div>
                                     <div className={`p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center w-full min-w-[200px] shadow-inner backdrop-blur-md ${countdown.badgeClass}`}>
                                       {countdown.isExpired ? (
                                         <div className="flex items-center gap-2 animate-pulse text-rose-400">
                                            <FontAwesomeIcon icon={faTimes} className="text-xl" />
                                            <span className="font-black text-lg sm:text-xl uppercase tracking-widest">WAKTU HABIS</span>
                                         </div>
                                       ) : (
                                         <div className="flex gap-2 text-white">
                                           {countdown.days > 0 && (
                                              <div className="flex flex-col items-center bg-black/40 px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 shadow min-w-[3rem]">
                                                <span className="text-rose-300 font-mono font-black text-lg sm:text-2xl leading-none">{countdown.days}</span>
                                                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-1 uppercase">Hari</span>
                                              </div>
                                           )}
                                           <div className="flex flex-col items-center bg-black/40 px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 shadow min-w-[3rem]">
                                             <span className="text-amber-300 font-mono font-black text-lg sm:text-2xl leading-none">{String(countdown.hours).padStart(2, '0')}</span>
                                             <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-1 uppercase">Jam</span>
                                           </div>
                                           <div className="flex flex-col items-center bg-black/40 px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 shadow min-w-[3rem]">
                                             <span className="text-emerald-300 font-mono font-black text-lg sm:text-2xl leading-none">{String(countdown.minutes).padStart(2, '0')}</span>
                                             <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-1 uppercase">Mnt</span>
                                           </div>
                                           <div className="flex flex-col items-center bg-black/40 px-2 sm:px-3 py-1.5 rounded-lg border border-white/5 shadow min-w-[3rem]">
                                             <span className="text-cyan-300 font-mono font-black text-lg sm:text-2xl leading-none animate-pulse">{String(countdown.seconds).padStart(2, '0')}</span>
                                             <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 mt-1 uppercase">Dtk</span>
                                           </div>
                                         </div>
                                       )}
                                     </div>
                                  </div>
                                </div>
                              )
                            } else {
                              return (
                                <div key={idx} className="flex flex-col lg:flex-row p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-cyan-950/40 to-[#0B1021] border-l-[6px] border-l-cyan-500 border-y border-r border-cyan-500/10 hover:from-cyan-900/30 transition-all duration-300 shadow-lg relative overflow-hidden gap-5 items-stretch w-full">
                                  <div className="flex-1 flex flex-col justify-between z-10 space-y-3 min-w-0">
                                    <div>
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="inline-flex items-center justify-center px-2.5 py-1 bg-cyan-500/20 text-cyan-300 text-[10px] font-black tracking-widest rounded-md uppercase border border-cyan-500/30 shadow-inner shrink-0">
                                          <FontAwesomeIcon icon={faCheckCircle} className="mr-1.5" /> AGENDA KEGIATAN
                                        </span>
                                      </div>
                                      <h4 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide leading-snug drop-shadow-md break-words whitespace-normal">
                                        {item.title}
                                      </h4>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2.5 text-xs">
                                      <span className="text-slate-200 font-bold bg-slate-900/80 px-3 py-1.5 rounded-lg border border-white/10 shadow-sm flex items-center gap-2 break-words">
                                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-cyan-400"/>
                                        Desa {item.desa}, Kec. {item.kecamatan}
                                      </span>
                                      {item.sdmName && (
                                        <span className="text-emerald-200 font-bold bg-emerald-950/80 px-3 py-1.5 rounded-lg border border-emerald-500/30 shadow-sm flex items-center gap-2 break-words">
                                          <FontAwesomeIcon icon={faUser} className="text-emerald-400"/>
                                          {item.sdmName}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="lg:w-auto w-full flex flex-col items-center justify-center z-10 shrink-0 border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-5">
                                     <div className="flex items-center gap-2 mb-2">
                                        <FontAwesomeIcon icon={faCalendarCheck} className="text-cyan-400 text-sm" />
                                        <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-slate-400">
                                          JADWAL PELAKSANAAN
                                        </span>
                                     </div>
                                     <div className="bg-black/40 border border-cyan-500/30 px-5 sm:px-6 py-3 rounded-xl flex flex-col items-center justify-center w-full min-w-[200px] shadow-inner backdrop-blur-md">
                                        <div className="font-mono font-black text-2xl sm:text-3xl flex items-center gap-2 text-white">
                                          <FontAwesomeIcon icon={faClock} className="animate-pulse text-cyan-400 text-xl" />
                                          <span>{item.sortTime}</span>
                                        </div>
                                        <div className="mt-1 text-[11px] font-bold text-cyan-400 tracking-widest bg-cyan-950/50 px-3 py-0.5 rounded-full border border-cyan-500/20">
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
                <div className="text-center py-16 text-slate-400 italic text-sm border-2 border-dashed border-white/10 rounded-[2rem] bg-slate-900/30 shadow-inner w-full">
                  <div className="mb-3">
                    <FontAwesomeIcon icon={faCalendarAlt} className="text-4xl text-slate-600" />
                  </div>
                  Semua tugas atau agenda penting saat ini sudah selesai/terlewati.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: LOKASI LIVE SDM (PETA KEBERADAAN)                  */}
      {/* ========================================================= */}
      {mainMenuTab === 'lokasi' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white border-b border-blue-500/20 pb-4">
            <div className="flex items-center gap-3">
              <FontAwesomeIcon icon={faMapMarkedAlt} className="text-2xl sm:text-3xl text-blue-400 drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]" />
              <h2 className="text-xl sm:text-3xl font-black tracking-wide uppercase drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-r from-blue-100 to-blue-400 break-words">
                Peta Lokasi SDM (Real-Time)
              </h2>
            </div>
            <span className="text-xs font-bold text-blue-200 bg-blue-900/60 px-4 py-2 rounded-xl border border-blue-500/30 flex items-center gap-2 w-fit shadow-inner">
              <FontAwesomeIcon icon={faGlobe} className="animate-pulse text-blue-400" />
              Monitoring {keberadaanList.length} Personal SDM
            </span>
          </div>

          <div className="p-5 sm:p-8 rounded-[2rem] bg-gradient-to-br from-[#0B1021] to-[#0F172A] border border-blue-500/20 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/5 rounded-full blur-[100px] pointer-events-none"></div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-2 relative z-10">
              {keberadaanList.map((item, idx) => (
                <div key={idx} className="p-4 sm:p-5 rounded-2xl bg-black/40 border border-white/5 flex flex-col gap-3 hover:border-blue-500/40 hover:bg-blue-950/20 transition-all duration-300 shadow-inner">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-100 text-sm uppercase tracking-wide break-words leading-tight">
                      {item.name}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{item.role}</span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-[11px] font-bold">
                    <span className={`px-3 py-1.5 rounded-lg flex items-start gap-2 w-full break-words whitespace-normal border shadow-inner ${
                      item.hasAgenda 
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30' 
                        : (item.location === 'Sekretariat PKH' 
                            ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/30' 
                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30'
                          )
                    }`}>
                      <FontAwesomeIcon icon={faMapMarkerAlt} className={`mt-0.5 ${item.hasAgenda ? 'animate-bounce' : ''}`} />
                      <span className="leading-snug">{item.location}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-start gap-2 text-[10px] text-slate-400 bg-white/5 p-2 rounded-lg border border-white/5">
                    <FontAwesomeIcon icon={faInfoCircle} className="mt-0.5 text-slate-500" />
                    <span className="break-words whitespace-normal leading-snug">{item.statusText}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: INFORMASI & OPERASIONAL (PAPAN, PIKET, SWAP LOG)   */}
      {/* ========================================================= */}
      {mainMenuTab === 'papan' && (
        <div className="space-y-6 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="p-5 sm:p-6 rounded-[2rem] bg-[#0F172A]/80 border border-amber-500/20 backdrop-blur-xl shadow-2xl space-y-4 hover:border-amber-400/40 transition-all duration-300">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3 text-amber-400">
                  <FontAwesomeIcon icon={faBullhorn} className="text-xl sm:text-2xl" />
                  <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">Papan Pengumuman</h2>
                </div>
                <span className="text-[10px] font-bold text-amber-300 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/30">
                  {infoList.length} Item
                </span>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                {infoList.length > 0 ? (
                  infoList.map((info) => (
                    <div key={info.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 relative group hover:border-amber-500/30 transition-all">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="font-bold text-amber-300 text-sm break-words leading-snug">{info.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 break-words whitespace-normal font-medium bg-white/5 px-2 py-0.5 rounded">{info.dateStr || '-'}</span>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words">{info.content}</p>
                      {isAdmin && (
                        <button onClick={() => handleDeleteInfo(info.id)} className="mt-3 text-[10px] px-3 py-1 bg-rose-950/50 rounded-lg text-rose-400 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer border border-rose-500/30 w-fit">
                          <FontAwesomeIcon icon={faTrashAlt} /> <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 italic bg-white/5 rounded-2xl border border-white/5">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-2xl mb-2 block mx-auto text-slate-600" />
                    Belum ada pengumuman.
                  </div>
                )}
              </div>
            </div>

            <div className="p-5 sm:p-6 rounded-[2rem] bg-[#0F172A]/80 border border-indigo-500/20 backdrop-blur-xl shadow-2xl space-y-4 hover:border-indigo-400/40 transition-all duration-300">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3 text-indigo-400">
                  <FontAwesomeIcon icon={faStickyNote} className="text-xl sm:text-2xl" />
                  <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">Catatan Operasional</h2>
                </div>
                <span className="text-[10px] font-bold text-indigo-300 bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-500/30">
                  {notesList.length} Item
                </span>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
                {notesList.length > 0 ? (
                  notesList.map((note) => (
                    <div key={note.id} className="p-4 rounded-2xl bg-black/40 border border-white/5 relative group hover:border-indigo-500/30 transition-all">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <span className="font-bold text-indigo-300 text-sm break-words leading-snug">{note.title}</span>
                        <span className="text-[10px] text-slate-400 shrink-0 break-words whitespace-normal font-medium bg-white/5 px-2 py-0.5 rounded">{note.dateStr || '-'}</span>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words">{note.content}</p>
                      {isAdmin && (
                        <button onClick={() => handleDeleteNote(note.id)} className="mt-3 text-[10px] px-3 py-1 bg-rose-950/50 rounded-lg text-rose-400 hover:text-white font-bold flex items-center gap-1.5 cursor-pointer border border-rose-500/30 w-fit">
                          <FontAwesomeIcon icon={faTrashAlt} /> <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-500 italic bg-white/5 rounded-2xl border border-white/5">
                    <FontAwesomeIcon icon={faInfoCircle} className="text-2xl mb-2 block mx-auto text-slate-600" />
                    Belum ada catatan.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 w-full">
            {/* KARTU PIKET */}
            <div className="p-5 sm:p-6 rounded-[2rem] bg-[#0F172A]/80 border border-emerald-500/20 backdrop-blur-xl shadow-2xl flex flex-col h-[350px]">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <FontAwesomeIcon icon={faUserShield} className="text-lg sm:text-xl" />
                  <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">Piket Hari Ini</h3>
                </div>
                <span className="text-[9px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-1 rounded border border-emerald-500/30 flex items-center gap-1">
                  <FontAwesomeIcon icon={faClock} /> Live
                </span>
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                {safeTodayPiket.length > 0 ? (
                  safeTodayPiket.map((p, idx) => {
                    const staffId = typeof p === 'object' && p !== null ? (p.staffId || p.id || p.name || p.NAMA || p.nama || JSON.stringify(p)) : p;
                    const currentHour = dateObj.getHours();
                    const isDone = currentHour >= 16; 
                    const isActive = currentHour >= 8 && !isDone;
                    
                    return (
                      <div key={idx} className="p-3.5 rounded-2xl bg-black/40 border border-white/5 flex justify-between items-center">
                        <div className="flex flex-col gap-1 min-w-0 pr-3">
                          <span className="font-bold text-slate-100 text-sm break-words whitespace-normal leading-tight">{getStaffName(staffId)}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${isDone ? 'text-slate-500' : (isActive ? 'text-emerald-400' : 'text-amber-400')}`}>
                            {isDone ? 'Selesai Tugas' : (isActive ? 'Sedang Bertugas' : 'Menunggu Waktu')}
                          </span>
                        </div>
                        <div className="flex items-center shrink-0">
                          {isActive && (
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                          )}
                          {isDone && <FontAwesomeIcon icon={faCheckCircle} className="text-slate-600 text-lg" />}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-xs text-slate-500 italic">Tidak ada jadwal piket hari ini.</p>
                  </div>
                )}
              </div>
              <button onClick={() => setIsNotesModalOpen(true)} className="mt-4 w-full py-2.5 rounded-xl bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-900/60 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer">
                <FontAwesomeIcon icon={faClipboardList} /> Standar Piket
              </button>
            </div>

            {/* KARTU AGENDA RINGKAS */}
            <div className="p-5 sm:p-6 rounded-[2rem] bg-[#0F172A]/80 border border-cyan-500/20 backdrop-blur-xl shadow-2xl flex flex-col h-[350px]">
              <div className="flex flex-col gap-3 mb-4 shrink-0">
                <div className="flex items-center gap-2.5 text-cyan-400">
                  <FontAwesomeIcon icon={faCalendarCheck} className="text-lg sm:text-xl" />
                  <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">Agenda Mini</h3>
                </div>
                <div className="flex bg-black/40 p-1.5 rounded-xl border border-white/5 w-fit">
                  <button onClick={() => setAgendaTab('today')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${agendaTab === 'today' ? 'bg-cyan-600/80 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    Hari Ini ({activeTodayAgenda.length})
                  </button>
                  <button onClick={() => setAgendaTab('upcoming3')} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${agendaTab === 'upcoming3' ? 'bg-indigo-600/80 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
                    +3 Hari ({activeUpcomingAgenda.length})
                  </button>
                </div>
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                {agendaTab === 'today' ? (
                  activeTodayAgenda.length > 0 ? (
                    activeTodayAgenda.map((ag, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-xs">
                        <span className="font-bold text-cyan-200 block break-words whitespace-normal leading-snug">{ag.title}</span>
                        <span className="text-[10px] text-slate-400 block mt-1.5 break-words whitespace-normal">
                          📍 Desa {ag.desa}, Kec. {ag.kecamatan} | ⏰ {ag.time}
                        </span>
                        {ag.sdmName && <span className="text-[10px] text-emerald-400 font-bold block mt-1 break-words whitespace-normal">👤 {ag.sdmName}</span>}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic text-xs">Tidak ada agenda hari ini.</div>
                  )
                ) : (
                  activeUpcomingAgenda.length > 0 ? (
                    activeUpcomingAgenda.map((ag, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-black/40 border border-indigo-500/20 text-xs">
                        <div className="flex justify-between items-start mb-1.5 gap-2">
                          <span className="font-bold text-indigo-300 block break-words whitespace-normal flex-1 leading-snug">{ag.title}</span>
                          <span className="text-[9px] font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-500/30 shrink-0 whitespace-nowrap">{ag.date}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 block break-words whitespace-normal">📍 Desa {ag.desa}, Kec. {ag.kecamatan} | ⏰ {ag.time}</span>
                        {ag.sdmName && <span className="text-[10px] text-emerald-400 font-bold block mt-1 break-words whitespace-normal">👤 {ag.sdmName}</span>}
                      </div>
                    ))
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 italic text-xs">Kosong untuk 3 hari ke depan.</div>
                  )
                )}
              </div>
            </div>

            {/* KARTU LOG PERTUKARAN PIKET */}
            <div className="p-5 sm:p-6 rounded-[2rem] bg-[#0F172A]/80 border border-purple-500/20 backdrop-blur-xl shadow-2xl flex flex-col h-[350px]">
              <div className="flex items-center justify-between mb-4 shrink-0">
                <div className="flex items-center gap-2.5 text-purple-400">
                  <FontAwesomeIcon icon={faExchangeAlt} className="text-lg sm:text-xl" />
                  <h3 className="font-black text-sm sm:text-base text-white uppercase tracking-wide">Log Swap Piket</h3>
                </div>
                {isAdmin && validSwapLogs.length > 0 && (
                  <button onClick={handleClearAllLogs} className="px-2.5 py-1.5 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 hover:bg-rose-900 hover:text-white text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0">
                    <FontAwesomeIcon icon={faTrashAlt} /> Kosongkan
                  </button>
                )}
              </div>
              <div className="space-y-3 overflow-y-auto pr-2 flex-1 custom-scrollbar">
                {validSwapLogs.length > 0 ? (
                  validSwapLogs.map((log, idx) => (
                    <div key={log.id || idx} className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-xs text-slate-300 relative group">
                      <div className="font-bold text-purple-300 flex flex-col gap-1 leading-relaxed">
                        <span className="break-words whitespace-normal text-[11px]"><span className="text-slate-400 font-medium">A:</span> {getStaffName(log.staffA)} {log.dayNumberA ? `(Tgl ${log.dayNumberA})` : ''}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-amber-400 px-1 bg-amber-900/30 rounded text-[10px]">⇄ Ditukar ke</span>
                        </div>
                        <span className="break-words whitespace-normal text-[11px]"><span className="text-slate-400 font-medium">B:</span> {getStaffName(log.staffB)} {log.dayNumberB ? `(Tgl ${log.dayNumberB})` : ''}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 mt-2 border-t border-white/5">
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/20">✓ Terekam Resmi</span>
                        {isAdmin && (
                          <div className="flex items-center gap-2 shrink-0 bg-black/60 px-2 py-1 rounded-lg">
                            <button onClick={() => handleOpenEditLog(log)} className="text-slate-400 hover:text-cyan-400 p-1 cursor-pointer"><FontAwesomeIcon icon={faEdit} /></button>
                            <button onClick={() => handleDeleteSingleLog(log.id)} className="text-slate-400 hover:text-rose-400 p-1 cursor-pointer"><FontAwesomeIcon icon={faTrashAlt} /></button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-500 italic text-xs">Belum ada log pertukaran.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* MODAL EDIT LOG (DIKUNCI) */}
      {editLogModalOpen && editingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md p-6 sm:p-8 rounded-[2rem] bg-[#0F172A] border border-purple-500/40 shadow-2xl relative space-y-5 animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => { setEditLogModalOpen(false); setEditingLog(null); }} className="absolute top-6 right-6 text-slate-500 hover:text-white cursor-pointer"><FontAwesomeIcon icon={faTimes} className="text-xl" /></button>
            <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-3 uppercase tracking-wide"><FontAwesomeIcon icon={faEdit} className="text-purple-400" /><span>Edit Swap Log</span></h3>
            <form onSubmit={handleSaveEditedLog} className="space-y-4">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-indigo-300 uppercase tracking-widest block">Pihak A</span>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Nama SDM A</label>
                  <select value={editingLog.staffA || ''} onChange={(e) => setEditingLog({ ...editingLog, staffA: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none"><option value="">-- Pilih --</option>{staffList.map((s) => { const sId = typeof s === 'object' ? s.id || s.name : s; const sName = typeof s === 'object' ? s.name || s.NAMA || s.id : s; return <option key={sId} value={sId}>{sName}</option>; })}</select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Tanggal A</label>
                  <input type="number" value={editingLog.dayNumberA || ''} onChange={(e) => setEditingLog({ ...editingLog, dayNumberA: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none" />
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest block">Pihak B</span>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Nama SDM B</label>
                  <select value={editingLog.staffB || ''} onChange={(e) => setEditingLog({ ...editingLog, staffB: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none"><option value="">-- Pilih --</option>{staffList.map((s) => { const sId = typeof s === 'object' ? s.id || s.name : s; const sName = typeof s === 'object' ? s.name || s.NAMA || s.id : s; return <option key={sId} value={sId}>{sName}</option>; })}</select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Tanggal B</label>
                  <input type="number" value={editingLog.dayNumberB || ''} onChange={(e) => setEditingLog({ ...editingLog, dayNumberB: e.target.value })} className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white text-xs outline-none" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => { setEditLogModalOpen(false); setEditingLog(null); }} className="px-5 py-2.5 rounded-xl bg-white/5 text-white text-xs font-bold cursor-pointer hover:bg-white/10">Batal</button>
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-lg"><FontAwesomeIcon icon={faSave} /><span>Simpan</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PETUNJUK PIKET (DIKUNCI) */}
      {isNotesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 sm:p-8 rounded-[2rem] bg-[#0F172A] border border-amber-500/40 shadow-2xl relative animate-fadeIn max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button onClick={() => setIsNotesModalOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white cursor-pointer"><FontAwesomeIcon icon={faTimes} className="text-xl" /></button>
            <div className="flex items-center gap-3 mb-6 text-amber-400"><FontAwesomeIcon icon={faInfoCircle} className="text-2xl" /><h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-wide">SOP Tugas Piket</h3></div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
              {piketNotes.map((note, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-black/40 border border-white/5 flex items-start gap-4 text-xs sm:text-sm text-slate-200">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center shrink-0 border border-amber-500/30">{idx + 1}</span>
                  <span className="leading-relaxed break-words whitespace-normal">{note}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setIsNotesModalOpen(false)} className="w-full mt-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all cursor-pointer active:scale-95">Saya Mengerti & Laksanakan</button>
          </div>
        </div>
      )}
    </div>
  );
}
