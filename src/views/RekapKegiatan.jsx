import React, { useState, useMemo, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, 
  faFileExcel, 
  faFilter, 
  faSearch,
  faCalendarCheck,
  faMapMarkerAlt,
  faClock,
  faCheckCircle,
  faHourglassHalf
} from '@fortawesome/free-solid-svg-icons';

export default function RekapKegiatan({ tasks = [], agendas = [], staffList = [] }) {
  const [currentTime, setCurrentTime] = useState(new Date().getTime());
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [searchTerm, setSearchTerm] = useState('');

  // Update waktu setiap menit untuk akurasi countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().getTime()), 60000);
    return () => clearInterval(timer);
  }, []);

  const months = [
    { value: '01', label: 'Januari' }, { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' }, { value: '04', label: 'April' },
    { value: '05', label: 'Mei' }, { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' }, { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' }, { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' }, { value: '12', label: 'Desember' }
  ];
  
  const currentYear = today.getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - 2 + i));

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

  const getLocalFormat = (input) => {
    if (!input) return { dateStr: '', timeStr: '' };
    if (!input.includes('T')) return { dateStr: input, timeStr: '-' };
    const d = new Date(input);
    if (isNaN(d.getTime())) return { dateStr: input.split('T')[0], timeStr: input.split('T')[1] || '-' };
    
    const pad = (n) => String(n).padStart(2, '0');
    return {
      dateStr: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      timeStr: `${pad(d.getHours())}:${pad(d.getMinutes())}`
    };
  };

  const formatIndoDate = (dateStr) => {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'][d.getDay()];
    const bulan = months[d.getMonth()].label;
    return `${hari}, ${parseInt(parts[2])} ${bulan} ${parts[0]}`;
  };

  const allActivities = useMemo(() => {
    const combined = [];
    tasks.forEach(task => {
      const rawDate = task.dueDateTime || task.deadline || task.dueDate || '';
      const { dateStr, timeStr } = getLocalFormat(rawDate);
      const rawTimestamp = new Date(`${dateStr}T${timeStr !== '-' ? timeStr : '23:59'}`).getTime();
      
      combined.push({
        id: task.id || Math.random().toString(),
        title: task.title,
        type: 'Deadline',
        rawDate: dateStr,
        formattedDate: formatIndoDate(dateStr),
        time: timeStr !== '-' ? timeStr : '23:59',
        locationOrTarget: getTargetText(task),
        rawTimestamp
      });
    });

    agendas.forEach(ag => {
      const { dateStr } = getLocalFormat(ag.date || '');
      const rawTimestamp = new Date(`${dateStr}T${ag.time || '00:00'}`).getTime();

      combined.push({
        id: ag.id || Math.random().toString(),
        title: ag.title,
        type: 'Agenda',
        rawDate: dateStr,
        formattedDate: formatIndoDate(dateStr),
        time: ag.time || '-',
        locationOrTarget: `Desa ${ag.desa || '-'}, Kec. ${ag.kecamatan || '-'} ${ag.sdmName ? `(${ag.sdmName})` : ''}`,
        rawTimestamp
      });
    });

    return combined.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }, [tasks, agendas, staffList]);

  const filteredActivities = useMemo(() => {
    return allActivities.map(item => {
      const diff = item.rawTimestamp - currentTime;
      const isPast = diff < 0;
      let countdown = '';

      if (!isPast) {
        const daysLeft = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minsLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (daysLeft > 0) countdown = `${daysLeft} Hari Lagi`;
        else if (hoursLeft > 0) countdown = `${hoursLeft} Jam Lagi`;
        else countdown = `${minsLeft} Menit Lagi`;
      }

      return { ...item, isPast, countdown };
    }).filter(item => {
      if (!item.rawDate) return false;
      const [year, month] = item.rawDate.split('-');
      
      const matchMonth = month === selectedMonth;
      const matchYear = year === selectedYear;
      const matchSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.locationOrTarget.toLowerCase().includes(searchTerm.toLowerCase());

      return matchMonth && matchYear && matchSearch;
    });
  }, [allActivities, selectedMonth, selectedYear, searchTerm, currentTime]);

  const handleExportCSV = () => {
    if (filteredActivities.length === 0) {
      alert("Tidak ada data untuk diexport pada bulan ini.");
      return;
    }

    let csvContent = "No,Nama Kegiatan,Jenis,Tanggal,Jam,Lokasi / Target,Status\n";

    filteredActivities.forEach((item, index) => {
      const title = `"${(item.title || '').replace(/"/g, '""')}"`;
      const type = `"${item.type}"`;
      const date = `"${item.formattedDate}"`;
      const time = `"${item.time}"`;
      const location = `"${(item.locationOrTarget || '').replace(/"/g, '""')}"`;
      const status = `"${item.isPast ? 'Selesai' : 'Belum Terlaksana'}"`;
      csvContent += `${index + 1},${title},${type},${date},${time},${location},${status}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const monthName = months.find(m => m.value === selectedMonth)?.label;
    
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Kegiatan_${monthName}_${selectedYear}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-fadeIn w-full pb-10">
      
      {/* Header Section */}
      <div className="p-5 sm:p-8 rounded-3xl bg-slate-900 border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden">
        <div className="absolute -top-12 -left-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-extrabold uppercase tracking-widest">
              Laporan Sistem
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-wide flex items-center gap-3">
            <FontAwesomeIcon icon={faCalendarAlt} className="text-emerald-400" />
            Rekap Kegiatan Bulanan
          </h1>
          <p className="text-sm font-semibold text-slate-400">
            Arsip dan pantauan seluruh Agenda maupun Deadline Tugas.
          </p>
        </div>

        <button 
          onClick={handleExportCSV}
          className="z-10 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] active:scale-95"
        >
          <FontAwesomeIcon icon={faFileExcel} className="text-lg" />
          Export Data (CSV)
        </button>
      </div>

      {/* Filter Section */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 rounded-xl border border-white/10 w-full sm:w-auto">
            <FontAwesomeIcon icon={faFilter} className="text-slate-400" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-sm outline-none font-bold cursor-pointer w-full"
            >
              {months.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 rounded-xl border border-white/10 w-full sm:w-auto">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-white text-sm outline-none font-bold cursor-pointer w-full"
            >
              {years.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded-xl border border-white/10 w-full sm:w-72 focus-within:border-emerald-500/50 transition-colors">
          <FontAwesomeIcon icon={faSearch} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari kegiatan/lokasi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none text-sm font-semibold text-white w-full placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden w-full">
        <div className="w-full overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-950/80 text-slate-400 text-xs uppercase tracking-widest border-b border-white/10">
                <th className="p-4 font-extrabold whitespace-nowrap">No</th>
                <th className="p-4 font-extrabold whitespace-nowrap">Nama Kegiatan</th>
                <th className="p-4 font-extrabold whitespace-nowrap">Jenis</th>
                <th className="p-4 font-extrabold whitespace-nowrap">Tanggal</th>
                <th className="p-4 font-extrabold whitespace-nowrap">Jam</th>
                <th className="p-4 font-extrabold whitespace-nowrap">Lokasi / Target</th>
                <th className="p-4 font-extrabold whitespace-nowrap">Status Waktu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredActivities.length > 0 ? (
                filteredActivities.map((item, index) => (
                  <tr 
                    key={item.id} 
                    className={`hover:bg-white/5 transition-colors group ${
                      item.isPast ? 'border-l-4 border-l-rose-500' : 'border-l-4 border-l-emerald-500'
                    }`}
                  >
                    <td className="p-4 text-sm font-extrabold text-slate-500 whitespace-nowrap">{index + 1}</td>
                    <td className="p-4 text-sm font-extrabold text-white whitespace-nowrap tracking-wide">{item.title}</td>
                    <td className="p-4 text-sm whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${
                        item.type === 'Agenda' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-300 whitespace-nowrap tracking-wide">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faCalendarCheck} className="text-slate-500" />
                        {item.formattedDate}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-300 whitespace-nowrap tracking-wide">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faClock} className="text-slate-500" />
                        {item.time}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold text-slate-300 whitespace-nowrap tracking-wide">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="text-slate-500" />
                        {item.locationOrTarget}
                      </div>
                    </td>
                    <td className="p-4 text-sm font-bold whitespace-nowrap tracking-wide">
                      {item.isPast ? (
                        <span className="flex items-center gap-2 text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-lg w-max">
                          <FontAwesomeIcon icon={faCheckCircle} />
                          Sudah Selesai
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg w-max">
                          <FontAwesomeIcon icon={faHourglassHalf} className="animate-pulse" />
                          {item.countdown}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="p-12 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-500">
                      <FontAwesomeIcon icon={faSearch} className="text-3xl opacity-50 mb-2" />
                      <span className="text-sm font-extrabold uppercase tracking-widest">Tidak ada kegiatan</span>
                      <span className="text-xs font-semibold">Coba ubah filter bulan atau kata kunci pencarian.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
