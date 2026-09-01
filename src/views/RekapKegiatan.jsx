import React, { useState, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCalendarAlt, 
  faFileExcel, 
  faTasks, 
  faCalendarCheck, 
  faMapMarkerAlt, 
  faUser,
  faFilter,
  faSearch
} from '@fortawesome/free-solid-svg-icons';

export default function RekapKegiatan({ tasks = [], agendas = [], staffList = [] }) {
  // Setup Waktu Default (Bulan & Tahun Saat Ini)
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [searchTerm, setSearchTerm] = useState('');

  // Opsi Bulan & Tahun
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

  // Helper mendapatkan nama SDM
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

  // 1. Normalisasi & Gabungkan Data
  const allActivities = useMemo(() => {
    const combined = [];

    tasks.forEach(task => {
      const rawDate = task.dueDateTime || task.deadline || task.dueDate || '';
      const { dateStr, timeStr } = getLocalFormat(rawDate);
      combined.push({
        id: task.id || Math.random().toString(),
        title: task.title,
        type: 'Deadline',
        date: dateStr,
        time: timeStr !== '-' ? timeStr : '23:59',
        locationOrTarget: getTargetText(task),
        rawTimestamp: new Date(`${dateStr}T${timeStr !== '-' ? timeStr : '23:59'}`).getTime()
      });
    });

    agendas.forEach(ag => {
      const { dateStr } = getLocalFormat(ag.date || '');
      combined.push({
        id: ag.id || Math.random().toString(),
        title: ag.title,
        type: 'Agenda',
        date: dateStr,
        time: ag.time || '-',
        locationOrTarget: `Desa ${ag.desa || '-'}, Kec. ${ag.kecamatan || '-'} ${ag.sdmName ? `(${ag.sdmName})` : ''}`,
        rawTimestamp: new Date(`${dateStr}T${ag.time || '00:00'}`).getTime()
      });
    });

    return combined.sort((a, b) => b.rawTimestamp - a.rawTimestamp); // Urutkan terbaru ke terlama
  }, [tasks, agendas, staffList]);

  // 2. Filter Berdasarkan Bulan, Tahun, dan Pencarian
  const filteredActivities = useMemo(() => {
    return allActivities.filter(item => {
      if (!item.date) return false;
      const [year, month] = item.date.split('-');
      
      const matchMonth = month === selectedMonth;
      const matchYear = year === selectedYear;
      const matchSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.locationOrTarget.toLowerCase().includes(searchTerm.toLowerCase());

      return matchMonth && matchYear && matchSearch;
    });
  }, [allActivities, selectedMonth, selectedYear, searchTerm]);

  // 3. Fungsi Export ke CSV
  const handleExportCSV = () => {
    if (filteredActivities.length === 0) {
      alert("Tidak ada data untuk diexport pada bulan ini.");
      return;
    }

    // Header CSV
    let csvContent = "No,Nama Kegiatan,Jenis,Tanggal,Jam,Lokasi / Target\n";

    // Data Rows (Escape koma dengan tanda kutip ganda)
    filteredActivities.forEach((item, index) => {
      const title = `"${(item.title || '').replace(/"/g, '""')}"`;
      const type = `"${item.type}"`;
      const date = `"${item.date}"`;
      const time = `"${item.time}"`;
      const location = `"${(item.locationOrTarget || '').replace(/"/g, '""')}"`;

      csvContent += `${index + 1},${title},${type},${date},${time},${location}\n`;
    });

    // Buat file Blob dan download
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
    <div className="space-y-6 animate-fadeIn max-w-full pb-10">
      
      {/* HEADER WIDGET */}
      <div className="p-5 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-white/10 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden">
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
          <p className="text-sm text-slate-400">
            Arsip seluruh Agenda dan Deadline Tugas secara historis.
          </p>
        </div>

        <button 
          onClick={handleExportCSV}
          className="z-10 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer active:scale-95"
        >
          <FontAwesomeIcon icon={faFileExcel} className="text-lg" />
          Export Data (CSV)
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 rounded-xl border border-white/10 w-full sm:w-auto">
            <FontAwesomeIcon icon={faFilter} className="text-slate-400" />
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-white text-sm outline-none font-semibold cursor-pointer w-full"
            >
              {months.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
            </select>
          </div>
          
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-950 rounded-xl border border-white/10 w-full sm:w-auto">
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-transparent text-white text-sm outline-none font-semibold cursor-pointer w-full"
            >
              {years.map(y => <option key={y} value={y} className="bg-slate-900">{y}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 rounded-xl border border-white/10 w-full sm:w-64 focus-within:border-emerald-500/50 transition-colors">
          <FontAwesomeIcon icon={faSearch} className="text-slate-400" />
          <input 
            type="text" 
            placeholder="Cari kegiatan/lokasi..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-transparent outline-none text-sm text-white w-full placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* TABEL DATA */}
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl overflow-hidden w-full">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-xs uppercase tracking-widest border-b border-white/10">
                <th className="p-4 fontUntuk menambahkan menu **Rekap Kegiatan** dengan fitur tabel *read-only* (hanya baca) dan bisa diekspor, cara paling efektif dan rapi adalah menggunakan *library* **DataTables** dikombinasikan dengan ekstensi **Buttons** (untuk ekspor ke Excel, PDF, atau CSV). 

Berikut adalah rancangan struktur tampilan dan kode yang bisa Anda terapkan (baik menggunakan Google Apps Script, PHP, maupun *framework* web lainnya).

### 1. Struktur *User Interface* (HTML & CSS)
Tabel dibuat tanpa kolom "Aksi" (seperti tombol edit/hapus) untuk memastikan statusnya murni *read-only*. Tambahkan filter bulan di atas tabel untuk memudahkan rekap per bulan.

```html
<!-- Load CSS DataTables & Ekstensi Export -->
<link rel="stylesheet" href="[https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css](https://cdn.datatables.net/1.13.6/css/jquery.dataTables.min.css)">
<link rel="stylesheet" href="[https://cdn.datatables.net/buttons/2.4.1/css/buttons.dataTables.min.css](https://cdn.datatables.net/buttons/2.4.1/css/buttons.dataTables.min.css)">

<div class="container-rekap">
    <h2>Rekap Kegiatan Bulanan</h2>
    
    <!-- Opsi Filter Bulan (Jika data di-load semua lalu difilter di sisi client) -->
    <div style="margin-bottom: 20px;">
        <label for="filterBulan">Pilih Bulan: </label>
        <input type="month" id="filterBulan" class="form-control">
    </div>

    <!-- Struktur Tabel -->
    <table id="tabelRekap" class="display nowrap" style="width:100%">
        <thead>
            <tr>
                <th>No</th>
                <th>Nama Kegiatan</th>
                <th>Jenis Kegiatan</th>
                <th>Waktu</th>
                <th>Lokasi</th>
            </tr>
        </thead>
        <tbody>
            <!-- Contoh Data (Nanti diisi dinamis dari database/spreadsheet) -->
            <tr>
                <td>1</td>
                <td>Rapat Koordinasi Evaluasi</td>
                <td>Agenda</td>
                <td>2026-09-05 09:00</td>
                <td>Kantor Utama</td>
            </tr>
            <tr>
                <td>2</td>
                <td>Pengumpulan Laporan Lapangan</td>
                <td>Deadline</td>
                <td>2026-09-10 23:59</td>
                <td>Sistem Online</td>
            </tr>
        </tbody>
    </table>
</div>
