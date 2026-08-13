import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faStream, 
  faSearch, 
  faCalendarAlt, 
  faUser, 
  faMapMarkerAlt, 
  faClock, 
  faUserShield,
  faHourglassHalf
} from '@fortawesome/free-solid-svg-icons';

export default function TimelineView({ agendas = [], tasks = [], staffList = [] }) {
  const [filterSdm, setFilterSdm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());

  // Realtime Timer untuk Hitung Mundur Kegiatan (Setiap 1 detik)
  useEffect(() => {
    const timer = setInterval(() => setNowTimestamp(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getStaffName = (id) => {
    if (!id) return 'Tim Lapangan';
    const found = staffList.find((s) => (typeof s === 'object' ? s.id === id || s.key === id || s.NAMA === id || s.name === id : s === id));
    if (found) return typeof found === 'object' ? found.name || found.NAMA || found.nama || found.id : found;
    return id;
  };

  // Format Tanggal Bahasa Indonesia: dddd, dd mmmm yyyy (Contoh: Kamis, 13 Agustus 2026)
  const formatIndoDate = (dateStr) => {
    if (!dateStr) return '-';
    const cleanDateStr = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const dateObj = new Date(`${cleanDateStr}T00:00:00`);
    if (isNaN(dateObj.getTime())) return dateStr;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const dayName = days[dateObj.getDay()];
    const dayNum = dateObj.getDate();
    const monthName = months[dateObj.getMonth()];
    const year = dateObj.getFullYear();

    return `${dayName}, ${dayNum} ${monthName} ${year}`;
  };

  // Hitung Mundur Waktu Kegiatan (Realtime Countdown Ultra Elegant)
  const renderCountdown = (dateStr, timeStr) => {
    if (!dateStr) return null;

    const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const cleanTime = timeStr || '00:00';
    const targetIso = `${cleanDate}T${cleanTime.length === 5 ? cleanTime + ':00' : cleanTime}`;
    const targetTime = new Date(targetIso).getTime();

    if (isNaN(targetTime)) return null;

    const diff = targetTime - nowTimestamp;

    if (diff <= 0) {
      return (
        <span className="text-slate-400 font-semibold bg-slate-950/80 px-2.5 py-1 rounded-xl border border-white/10 text-[10px] shrink-0">
          ✓ Kegiatan Selesai / Lewat
        </span>
      );
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let formattedStr = '';
    if (days > 0) formattedStr += `${days}h `;
    formattedStr += `${String(hours).padStart(2, '0')}j ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

    return (
      <span className="text-amber-300 font-extrabold bg-amber-950/80 px-2.5 py-1 rounded-xl border border-amber-500/40 text-[10px] flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)] shrink-0">
        <FontAwesomeIcon icon={faHourglassHalf} className="animate-spin text-amber-400 text-[9px]" />
        <span>Sisa Waktu: {formattedStr}</span>
      </span>
    );
  };

  // Gabungkan Agenda & Tugas ke dalam Timeline Terurut Tanggal
  const timelineItems = [
    ...agendas.map((ag) => ({
      type: 'agenda',
      id: ag.id,
      title: ag.title,
      date: ag.date,
      time: ag.time,
      location: `Desa ${ag.desa || '-'}, Kec. ${ag.kecamatan || 'Tapin Utara'}`,
      category: ag.category || 'Agenda SDM',
      isSupervisi: ag.isSupervisiKatim,
      assigneeName: ag.sdmName || (ag.assignee ? getStaffName(ag.assignee) : 'Tim Lapangan')
    })),
    ...tasks.map((tk) => ({
      type: 'task',
      id: tk.id,
      title: tk.title,
      date: tk.dueDate ? tk.dueDate.split('T')[0] : (tk.dueDateTime ? tk.dueDateTime.split('T')[0] : ''),
      time: tk.dueDate && tk.dueDate.includes('T') ? tk.dueDate.split('T')[1] : (tk.dueDateTime && tk.dueDateTime.includes('T') ? tk.dueDateTime.split('T')[1].slice(0, 5) : '23:59'),
      location: 'Kantor / Online',
      category: 'Deadline Tugas',
      isSupervisi: false,
      assigneeName: getStaffName(tk.assignee)
    }))
  ].sort((a, b) => {
    const timeA = new Date(`${a.date || '1970-01-01'}T${a.time || '00:00'}`).getTime();
    const timeB = new Date(`${b.date || '1970-01-01'}T${b.time || '00:00'}`).getTime();
    return timeA - timeB;
  });

  // Filter Timeline
  const filteredTimeline = timelineItems.filter((item) => {
    const matchSdm = !filterSdm || item.assigneeName.toLowerCase().includes(filterSdm.toLowerCase());
    const matchDate = !filterDate || item.date === filterDate;
    const matchCat = !filterCategory || item.category.toLowerCase().includes(filterCategory.toLowerCase());
    return matchSdm && matchDate && matchCat;
  });

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full">
      {/* Header & Filter Bar Mobile-First */}
      <div className="p-4 sm:p-8 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass space-y-4 sm:space-y-6">
        <h2 className="text-base sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
          <FontAwesomeIcon icon={faStream} className="text-indigo-400 text-lg sm:text-xl" />
          <span>Timeline Kegiatan & Deadline SDM</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-4">
          <div>
            <label className="text-[11px] sm:text-xs text-slate-300 font-semibold block mb-1.5">Filter Nama SDM</label>
            <div className="relative">
              <FontAwesomeIcon icon={faUser} className="absolute left-3.5 top-3 sm:top-3.5 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Ketik nama petugas..."
                value={filterSdm}
                onChange={(e) => setFilterSdm(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 sm:py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] sm:text-xs text-slate-300 font-semibold block mb-1.5">Filter Tanggal</label>
            <div className="relative">
              <FontAwesomeIcon icon={faCalendarAlt} className="absolute left-3.5 top-3 sm:top-3.5 text-slate-500 text-xs" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 sm:py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] sm:text-xs text-slate-300 font-semibold block mb-1.5">Filter Kegiatan / Kategori</label>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3.5 top-3 sm:top-3.5 text-slate-500 text-xs" />
              <input
                type="text"
                placeholder="Cari kegiatan..."
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 sm:py-2.5 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Visual Timeline 3D Responsive Track */}
      <div className="relative border-l-2 border-indigo-500/40 ml-3.5 sm:ml-6 md:ml-8 pl-4 sm:pl-8 md:pl-10 space-y-5 sm:space-y-8 pr-1">
        {filteredTimeline.length > 0 ? (
          filteredTimeline.map((item, idx) => (
            <div key={idx} className="relative group">
              {/* Timeline Connector Node 3D */}
              <div className="absolute -left-[27px] sm:-left-[41px] md:-left-[49px] top-1.5 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-slate-950 border-2 border-indigo-400 flex items-center justify-center shadow-[0_0_15px_#6366f1] shrink-0">
                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-cyan-400 animate-ping"></div>
              </div>

              {/* Timeline Glass Card */}
              <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl shadow-3d-glass transform group-hover:-translate-y-1 transition-all duration-300 active:scale-[0.99] space-y-3">
                <div className="flex justify-between items-start flex-wrap gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border truncate ${
                    item.type === 'agenda'
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30'
                      : 'bg-purple-500/20 text-purple-300 border-purple-400/30'
                  }`}>
                    {item.category}
                  </span>

                  {/* Format Tanggal Resmi & Countdown */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-bold text-cyan-300 flex items-center gap-1.5 bg-cyan-950/60 px-2.5 py-1 rounded-xl border border-cyan-500/30 shrink-0">
                      <FontAwesomeIcon icon={faCalendarAlt} />
                      <span className="break-words">{formatIndoDate(item.date)}</span>
                      <span className="text-cyan-400/50 mx-0.5">|</span>
                      <FontAwesomeIcon icon={faClock} />
                      <span>{item.time || '00:00'} WITA</span>
                    </span>

                    {/* Badge Hitung Mundur Kegiatan */}
                    {renderCountdown(item.date, item.time)}
                  </div>
                </div>

                {/* Nama Kegiatan */}
                <h3 className="text-sm sm:text-lg font-bold text-white leading-snug break-words">{item.title}</h3>

                <div className="flex justify-between items-center flex-wrap gap-2 pt-2.5 border-t border-white/10 text-xs text-slate-300">
                  <span className="flex items-center gap-1.5 break-words text-[11px] sm:text-xs">
                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-rose-400 shrink-0" />
                    <span>{item.location}</span>
                  </span>

                  {/* Nama SDM / Petugas Pelaksana */}
                  <span className="flex items-center gap-1.5 text-emerald-300 font-bold bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-500/30 text-[10px] sm:text-xs break-words">
                    <FontAwesomeIcon icon={faUser} className="text-emerald-400 shrink-0" />
                    <span>SDM: {item.assigneeName}</span>
                  </span>

                  {item.isSupervisi && (
                    <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold text-[10px] sm:text-xs flex items-center gap-1 shrink-0">
                      <FontAwesomeIcon icon={faUserShield} /> Supervisi Katim
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 sm:p-8 text-center text-slate-400 bg-slate-900/40 rounded-3xl border border-white/5 text-xs sm:text-sm italic">
            Tidak ada kegiatan atau tugas yang sesuai dengan filter pencarian.
          </div>
        )}
      </div>
    </div>
  );
}