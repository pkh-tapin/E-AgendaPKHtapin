import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkerAlt, 
  faBuilding, 
  faLeaf, 
  faUserTie, 
  faUser,
  faSearch,
  faCalendarAlt,
  faCalendarWeek,
  faClock,
  faTimes,
  faCheckCircle,
  faClipboardList,
  faExclamationCircle,
  faMapPin,
  faPhone // Icon tambahan untuk Nomor Telepon
} from '@fortawesome/free-solid-svg-icons';

export default function LokasiSdmView({ 
  staffList = [], 
  todayPiket = [], // (Fallback prop)
  todayAgenda = [], // (Fallback prop)
  agendas = [],      // Digunakan untuk pelacakan agenda akurat
  schedules = {}     // Digunakan untuk pelacakan piket akurat
}) {
  
  // ---------------------------------------------------------------------------
  // 1. STATE & FILTERING (PENCARIAN REAL-TIME)
  // ---------------------------------------------------------------------------
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Jam Digital Realtime
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // PERBAIKAN ZONA WAKTU LOKAL (WITA/WIB/WIT) AGAR HARI TIDAK MELESET
  const localYear = currentTime.getFullYear();
  const localMonth = String(currentTime.getMonth() + 1).padStart(2, '0');
  const localDay = String(currentTime.getDate()).padStart(2, '0');
  const todayStrRealtime = `${localYear}-${localMonth}-${localDay}`;
  const currentMonthKey = `${localYear}-${localMonth}`;

  // Tarik data akurat dari Prop Schedules & Agendas berdasarkan Waktu Lokal
  const realtimeTodayPiket = schedules[currentMonthKey]?.[todayStrRealtime]?.assigned || [];
  const realtimeTodayAgenda = agendas.filter((ag) => {
    if (!ag.date) return false;
    const cleanDate = ag.date.includes('T') ? ag.date.split('T')[0] : ag.date;
    return cleanDate === todayStrRealtime;
  });

  // ---------------------------------------------------------------------------
  // 2. PEMBERSIHAN DATA SDM (MENCEGAH GHOST DATA, DUMMY, & HAPUS DUPLIKAT)
  // ---------------------------------------------------------------------------
  const getValidStaffList = () => {
    const uniqueStaff = [];
    const seenNames = new Set();
    
    // Daftar blacklist nama dummy sisa uji coba (A-H)
    const dummyNames = ['andi', 'budi', 'siti', 'dewi', 'eko', 'fajar', 'gita', 'hadi', 'iwan', 'joko', 'test'];

    staffList.forEach(staff => {
      if (!staff) return;
      const sdmName = (staff.name || staff.NAMA || staff.nama || staff.id || '').trim();
      
      if (sdmName && sdmName !== 'undefined' && sdmName !== 'null') {
        const lowerName = sdmName.toLowerCase();
        
        if (!seenNames.has(lowerName)) {
          
          // MENDETEKSI "GHOST DATA" ATAU SISA STRING TEST DI FIREBASE
          const isDummyName = dummyNames.includes(lowerName);
          
          // Data SDM riil (hasil import Excel) PASTI memiliki metadata tambahan (Jabatan, NIP, dsb).
          // Ghost data biasanya cuma berisi nama saja tanpa atribut terstruktur.
          const hasValidMetadata = Boolean(
            staff.jabatan || staff.jabatan_tim || staff.NIP || staff.nip || 
            staff.kecamatan || staff.desa || staff.status_pegawai || staff.no_hp || staff.email
          );

          // SYARAT DATA VALID (Untuk Menyamakan dengan Jumlah Akurat Database):
          // 1. BUKAN nama dummy test (Hadi, Budi, Siti, dll)
          // 2. HARUS punya atribut metadata resmi (Jabatan/NIP) ATAU nama panjang (minimal 2 kata yang menandakan nama riil)
          if (!isDummyName && (hasValidMetadata || lowerName.split(' ').length >= 2)) {
             seenNames.add(lowerName);
             uniqueStaff.push(staff);
          }
        }
      }
    });

    return uniqueStaff;
  };

  const validStaffList = getValidStaffList();

  const filteredStaffList = validStaffList.filter((staff) => {
    const sdmName = (staff.name || staff.NAMA || staff.nama || staff.id || '').toLowerCase();
    const sdmJabatan = (staff.jabatan || staff.jabatan_tim || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return sdmName.includes(search) || sdmJabatan.includes(search);
  });

  // ---------------------------------------------------------------------------
  // 3. LOGIKA UTAMA: PENENTUAN LOKASI HARI INI (FIXED MATCHING LOGIC)
  // ---------------------------------------------------------------------------
  const getStatusLokasiHariIni = (staff) => {
    const staffId = String(staff.id || '').trim();
    const sdmName = (staff.name || staff.NAMA || staff.nama || staff.id || '').trim().toLowerCase();
    const jabatan = (staff.jabatan || staff.jabatan_tim || '').toLowerCase();
    const isKetuaKabupaten = jabatan.includes('ketua tim kabupaten');

    // MENDETEKSI PIKET (Mencocokkan ID ataupun NAMA)
    const isPiket = realtimeTodayPiket.some(p => {
      const pVal = String(typeof p === 'object' ? (p.id || p.name || p.NAMA || '') : p).trim().toLowerCase();
      return pVal === staffId.toLowerCase() || pVal === sdmName;
    });

    // MENDETEKSI AGENDA LAPANGAN (Mencocokkan ID ataupun NAMA)
    const agendaSdm = realtimeTodayAgenda.find(ag => {
      const assignedList = ag.assigned || [];
      const isAssigned = Array.isArray(assignedList) 
         ? assignedList.some(val => {
             const strVal = String(typeof val === 'object' ? (val.id || val.name || '') : val).trim().toLowerCase();
             return strVal === staffId.toLowerCase() || strVal === sdmName;
           })
         : (typeof assignedList === 'string' && (assignedList.toLowerCase().includes(sdmName) || assignedList.includes(staffId)));
      
      const agSdmName = (ag.sdmName || '').toLowerCase();
      return agSdmName === sdmName || agSdmName === staffId.toLowerCase() || isAssigned;
    });

    // PRIORITAS 1: JIKA JADWAL PIKET -> MUTLAK DI SEKRETARIAT
    if (isPiket) {
      return {
        teks: 'Di Sekretariat PKH',
        subTeks: 'Sedang Melaksanakan Tugas Piket',
        tipe: 'sekretariat',
        icon: faBuilding,
        badgeBg: 'bg-indigo-500/20',
        cardBorder: 'border-indigo-500/50',
        warnaTeks: 'text-indigo-300',
        warnaIcon: 'text-indigo-400',
        gradient: 'from-indigo-950/40 to-slate-900/80'
      };
    }

    // PRIORITAS 2: JIKA ADA AGENDA -> MUTLAK DI LAPANGAN/DESA
    if (agendaSdm) {
      return {
        teks: 'Di Lapangan / Desa',
        subTeks: `Agenda: ${agendaSdm.title} (Desa ${agendaSdm.desa || '-'})`,
        tipe: 'agenda',
        icon: faMapMarkerAlt,
        badgeBg: 'bg-emerald-500/20',
        cardBorder: 'border-emerald-500/50',
        warnaTeks: 'text-emerald-300',
        warnaIcon: 'text-emerald-400',
        gradient: 'from-emerald-950/40 to-slate-900/80'
      };
    }

    // PRIORITAS 3: TIDAK PIKET & TIDAK AGENDA -> CEK JABATAN
    if (isKetuaKabupaten) {
      return {
        teks: 'Di Sekretariat PKH',
        subTeks: 'Standby / Tugas Manajerial',
        tipe: 'sekretariat',
        icon: faBuilding,
        badgeBg: 'bg-indigo-500/20',
        cardBorder: 'border-indigo-500/30',
        warnaTeks: 'text-indigo-300',
        warnaIcon: 'text-indigo-400',
        gradient: 'from-slate-900 to-indigo-950/30'
      };
    } else {
      return {
        teks: 'Di Lapangan',
        subTeks: 'Tugas Pemantauan / Kunjungan Rutin',
        tipe: 'lapangan',
        icon: faLeaf,
        badgeBg: 'bg-amber-500/20',
        cardBorder: 'border-amber-500/30',
        warnaTeks: 'text-amber-300',
        warnaIcon: 'text-amber-400',
        gradient: 'from-slate-900 to-amber-950/30'
      };
    }
  };

  // ---------------------------------------------------------------------------
  // 4. LOGIKA FORECAST (PRAKIRAAN) 7 HARI KEDEPAN 
  // ---------------------------------------------------------------------------
  const generate7DaysForecast = (staff) => {
    const staffId = String(staff.id || '').trim();
    const sdmName = (staff.name || staff.NAMA || staff.nama || staff.id || '').trim().toLowerCase();
    const jabatan = (staff.jabatan || staff.jabatan_tim || '').toLowerCase();
    const isKetuaKabupaten = jabatan.includes('ketua tim kabupaten');
    
    const forecast = [];
    const today = new Date(currentTime);

    for (let i = 1; i <= 7; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      
      const dateStr = targetDate.toISOString().split('T')[0];
      const monthKey = dateStr.substring(0, 7);
      
      const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
      const hari = namaHari[targetDate.getDay()];
      const tglIndo = `${hari}, ${targetDate.getDate()} / ${targetDate.getMonth() + 1} / ${targetDate.getFullYear()}`;
      const isWeekend = targetDate.getDay() === 0 || targetDate.getDay() === 6;

      // Cek Piket
      const piketList = schedules[monthKey]?.[dateStr]?.assigned || [];
      const isPiket = Array.isArray(piketList) && piketList.some(p => {
        const pVal = String(typeof p === 'object' ? (p.id || p.name || '') : p).trim().toLowerCase();
        return pVal === staffId.toLowerCase() || pVal === sdmName;
      });

      // Cek Agenda
      const agendaDay = agendas.find(ag => {
        const agDate = ag.date?.includes('T') ? ag.date.split('T')[0] : ag.date;
        const assignedList = ag.assigned || [];
        const isAssigned = Array.isArray(assignedList) 
           ? assignedList.some(val => {
               const strVal = String(typeof val === 'object' ? (val.id || val.name || '') : val).trim().toLowerCase();
               return strVal === staffId.toLowerCase() || strVal === sdmName;
             })
           : (typeof assignedList === 'string' && (assignedList.toLowerCase().includes(sdmName) || assignedList.includes(staffId)));
        
        const agSdmName = (ag.sdmName || '').toLowerCase();
        return agDate === dateStr && (agSdmName === sdmName || agSdmName === staffId.toLowerCase() || isAssigned);
      });

      let statusInfo = {};

      if (isWeekend && !isPiket && !agendaDay) {
         statusInfo = { status: 'Hari Libur / Off', icon: faCalendarAlt, color: 'text-slate-400', bg: 'bg-slate-800' };
      } else if (isPiket) {
         statusInfo = { status: 'Di Sekretariat (Tugas Piket)', icon: faBuilding, color: 'text-indigo-400', bg: 'bg-indigo-900/50', detail: 'Tugas Pelayanan Sekretariat' };
      } else if (agendaDay) {
         statusInfo = { status: 'Di Lapangan (Agenda)', icon: faMapMarkerAlt, color: 'text-emerald-400', bg: 'bg-emerald-900/50', detail: `Desa ${agendaDay.desa || '-'}: ${agendaDay.title}` };
      } else if (isKetuaKabupaten) {
         statusInfo = { status: 'Di Sekretariat PKH', icon: faBuilding, color: 'text-indigo-400', bg: 'bg-indigo-900/30', detail: 'Standby / Tugas Manajerial' };
      } else {
         statusInfo = { status: 'Di Lapangan', icon: faLeaf, color: 'text-amber-400', bg: 'bg-amber-900/30', detail: 'Tugas Pendampingan Rutin' };
      }

      forecast.push({ dateStr, tglIndo, isWeekend, ...statusInfo });
    }

    return forecast;
  };

  // ---------------------------------------------------------------------------
  // 5. RENDER ENGINE (UI)
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full pb-10">
      
      {/* HEADER COMPONENT */}
      <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/80 border border-indigo-500/30 backdrop-blur-2xl shadow-2xl relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-5 transition-all">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 relative z-10 w-full md:w-auto">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-400 text-2xl sm:text-3xl shadow-inner shrink-0">
            <FontAwesomeIcon icon={faMapPin} className="animate-bounce" />
          </div>
          <div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-wide drop-shadow-md flex items-center gap-2">
              Sistem Pelacakan Lokasi SDM
            </h1>
            <p className="text-xs sm:text-sm text-indigo-200/80 mt-1.5 leading-relaxed max-w-xl">
              Memantau status dan posisi seluruh SDM PKH secara Real-Time berdasarkan matriks jadwal piket, jabatan, dan agenda harian.
            </p>
          </div>
        </div>

        <div className="relative z-10 bg-slate-950/80 px-5 py-3 rounded-2xl border border-white/10 flex flex-col items-center justify-center shadow-inner w-full md:w-auto shrink-0">
           <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5">
             <FontAwesomeIcon icon={faClock} className="text-emerald-400 animate-pulse" /> Live Status
           </span>
           <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-wider text-center">
             {String(currentTime.getHours()).padStart(2,'0')}:{String(currentTime.getMinutes()).padStart(2,'0')}:{String(currentTime.getSeconds()).padStart(2,'0')}
           </span>
        </div>
      </div>

      {/* FILTER PENCARIAN & STATISTIK */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 relative z-10 w-full">
        <div className="relative w-full lg:w-96 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-400 transition-colors">
            <FontAwesomeIcon icon={faSearch} />
          </div>
          <input
            type="text"
            placeholder="Cari nama atau jabatan SDM..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3.5 bg-slate-900/80 border border-white/15 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 transition-all backdrop-blur-xl shadow-lg"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
          <span className="px-3 py-1.5 bg-slate-900/80 border border-white/10 rounded-xl text-xs font-bold text-slate-300 flex items-center gap-2 shadow-sm">
             <FontAwesomeIcon icon={faUser} className="text-slate-500" />
             Total Data Valid: {filteredStaffList.length} SDM
          </span>
          <span className="px-3 py-1.5 bg-indigo-900/40 border border-indigo-500/30 rounded-xl text-xs font-bold text-indigo-300 flex items-center gap-2 shadow-sm">
             <FontAwesomeIcon icon={faBuilding} className="text-indigo-400" />
             Sekretariat
          </span>
          <span className="px-3 py-1.5 bg-amber-900/40 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-2 shadow-sm">
             <FontAwesomeIcon icon={faLeaf} className="text-amber-400" />
             Lapangan / Desa
          </span>
        </div>
      </div>

      {/* GRID KARTU LOKASI SDM (HARIAN) */}
      {filteredStaffList.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 w-full relative z-10">
          {filteredStaffList.map((staff, idx) => {
            const sdmName = (staff.name || staff.NAMA || staff.nama || staff.id).trim();
            const jabatan = staff.jabatan || staff.jabatan_tim || 'SDM PKH';
            const isKetua = jabatan.toLowerCase().includes('ketua tim');
            
            // Pengambilan Nomor Telepon (Mendukung berbagai nama key dari database)
            const phoneStr = staff.no_hp || staff.no_WA || staff.no_wa || staff.whatsapp || staff.telepon || '';
            const phoneDisplay = phoneStr ? phoneStr : 'No. HP Belum Diisi';
            
            // Dapatkan Status Logika Berdasarkan Matriks Baru
            const statusLokasi = getStatusLokasiHariIni(staff);

            return (
              <div 
                key={idx} 
                className={`flex flex-col justify-between p-1 rounded-3xl bg-gradient-to-br ${statusLokasi.gradient} shadow-xl hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-300 group border ${statusLokasi.cardBorder}`}
              >
                <div className="p-5 rounded-[22px] bg-slate-950/70 backdrop-blur-xl h-full flex flex-col justify-between">
                  
                  {/* Bagian Atas: Profil */}
                  <div className="flex items-start gap-4 mb-5 border-b border-white/10 pb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 border shadow-inner ${isKetua ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
                      <FontAwesomeIcon icon={isKetua ? faUserTie : faUser} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-white text-sm sm:text-base truncate tracking-wide" title={sdmName}>
                        {sdmName}
                      </h3>
                      <div className="flex flex-col items-start gap-1 mt-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${isKetua ? 'bg-amber-950/60 border-amber-500/30 text-amber-300' : 'bg-slate-800 border-white/10 text-slate-400'}`}>
                          {jabatan}
                        </span>
                        {/* PENAMBAHAN NOMOR TELEPON */}
                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-slate-400 font-semibold mt-0.5" title="Nomor WhatsApp / Telepon">
                          <FontAwesomeIcon icon={faPhone} className={phoneStr ? 'text-emerald-400' : 'text-slate-500'} />
                          <span className={phoneStr ? 'text-slate-300' : 'text-slate-500 italic'}>
                            {phoneDisplay}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bagian Tengah: Status Lokasi Hari Ini */}
                  <div className="flex flex-col items-center justify-center p-4 rounded-xl border border-white/5 bg-black/20 mb-5 relative overflow-hidden group-hover:bg-black/40 transition-colors">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 shadow-lg ${statusLokasi.badgeBg} border ${statusLokasi.cardBorder}`}>
                       <FontAwesomeIcon icon={statusLokasi.icon} className={`text-xl ${statusLokasi.warnaIcon}`} />
                    </div>
                    <h4 className={`text-sm sm:text-base font-black tracking-wide uppercase text-center ${statusLokasi.warnaTeks}`}>
                      {statusLokasi.teks}
                    </h4>
                    <p className="text-[10px] sm:text-xs text-slate-400 text-center mt-1.5 px-2 font-medium">
                      {statusLokasi.subTeks}
                    </p>
                  </div>

                  {/* Bagian Bawah: Tombol Aksi Forecast 7 Hari */}
                  <button 
                    onClick={() => setSelectedStaff(staff)}
                    className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-indigo-600 hover:border-indigo-500 text-slate-300 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    <FontAwesomeIcon icon={faCalendarWeek} />
                    <span>Lihat Agenda 7 Hari Ke Depan</span>
                  </button>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="w-full py-20 rounded-3xl bg-slate-900/50 border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-slate-400 relative z-10 backdrop-blur-md">
          <FontAwesomeIcon icon={faSearch} className="text-4xl mb-4 text-slate-600" />
          <p className="text-sm font-semibold">Tidak ada SDM valid yang cocok dengan pencarian "{searchTerm}".</p>
          <button onClick={() => setSearchTerm('')} className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline font-bold cursor-pointer">Bersihkan Pencarian</button>
        </div>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* MODAL: PRAKIRAAN 7 HARI KEDEPAN BERDASARKAN NAMA SDM                     */}
      {/* ------------------------------------------------------------------------- */}
      {selectedStaff && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-slate-950 border border-indigo-500/40 rounded-3xl shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950/50 shrink-0">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-inner">
                   <FontAwesomeIcon icon={faCalendarWeek} className="text-lg" />
                 </div>
                 <div>
                   <h3 className="font-black text-white text-sm sm:text-base uppercase tracking-wide">Prakiraan Agenda 7 Hari</h3>
                   <p className="text-[10px] sm:text-xs text-indigo-300 font-bold truncate max-w-[200px] sm:max-w-full">
                     Atas Nama: {selectedStaff.name || selectedStaff.NAMA || selectedStaff.nama || selectedStaff.id}
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => setSelectedStaff(null)} 
                 className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-rose-500/80 transition-all flex items-center justify-center cursor-pointer border border-transparent hover:border-rose-400"
               >
                 <FontAwesomeIcon icon={faTimes} />
               </button>
            </div>

            {/* Modal Body (Scrollable List) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-900/50">
               <div className="space-y-3">
                 {generate7DaysForecast(selectedStaff).map((day, idx) => (
                   <div 
                     key={idx} 
                     className={`p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border transition-colors hover:bg-white/5
                     ${day.isWeekend ? 'bg-slate-950/80 border-white/5 opacity-70' : 'bg-slate-900/80 border-white/10 shadow-sm'}`}
                   >
                     {/* Kiri: Info Tanggal */}
                     <div className="flex items-center gap-3 min-w-[140px] shrink-0">
                       <div className="w-10 h-10 rounded-xl bg-black/40 border border-white/10 flex flex-col items-center justify-center shadow-inner">
                         <span className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">{day.tglIndo.split(',')[0]}</span>
                         <span className={`text-sm font-black leading-none ${day.isWeekend ? 'text-rose-400' : 'text-white'}`}>
                           {day.dateStr.split('-')[2]}
                         </span>
                       </div>
                       <div className="text-[10px] sm:text-xs font-bold text-slate-300">
                         {day.dateStr}
                       </div>
                     </div>

                     {/* Kanan: Info Lokasi/Status */}
                     <div className="flex-1 flex flex-col items-start sm:items-end">
                       <div className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-white/5 ${day.bg} ${day.color} shadow-sm`}>
                         <FontAwesomeIcon icon={day.icon} />
                         {day.status}
                       </div>
                       {day.detail && (
                         <div className="mt-1.5 text-[10px] text-slate-400 font-semibold flex items-center gap-1.5 text-left sm:text-right">
                           <FontAwesomeIcon icon={faClipboardList} className="text-slate-500" />
                           {day.detail}
                         </div>
                       )}
                     </div>
                   </div>
                 ))}
               </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-950 text-center shrink-0">
              <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium">
                Prakiraan lokasi ini digenerate secara otomatis berdasarkan irisan jadwal piket bulanan, agenda lapangan, dan peran struktural SDM pada database.
              </p>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}
