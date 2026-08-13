import React, { useState, useEffect, useRef } from 'react';
import { db, ref, push, remove, set } from '../firebase';
import { useToast } from '../context/ToastContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faTasks, 
  faPlus, 
  faTrash, 
  faEdit,
  faCalendarAlt, 
  faUser, 
  faGlobe, 
  faMapMarkerAlt,
  faLock,
  faHourglassHalf,
  faExclamationTriangle,
  faDownload,
  faUpload,
  faTimes,
  faCheckCircle
} from '@fortawesome/free-solid-svg-icons';

export default function TasksView({ tasks = [], staffList = [], isAdmin, onOpenLogin }) {
  const { showToast } = useToast();
  const fileInputRef = useRef(null);

  // -------------------------------------------------------------
  // DETEKSI ADMIN OTOMATIS DARI SIDEBAR / GLOBAL STATE
  // -------------------------------------------------------------
  const [isUserAdmin, setIsUserAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = () => {
      const storageAdmin = 
        localStorage.getItem('isAdmin') === 'true' ||
        localStorage.getItem('adminLoggedIn') === 'true' ||
        sessionStorage.getItem('isAdmin') === 'true';

      setIsUserAdmin(Boolean(isAdmin || storageAdmin));
    };

    checkAdmin();
    const timer = setInterval(checkAdmin, 500); // Polling sync dengan sidebar
    return () => clearInterval(timer);
  }, [isAdmin]);

  // State Form Input
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [title, setTitle] = useState('');
  const [dueDateTime, setDueDateTime] = useState('');
  const [targetType, setTargetType] = useState('all');
  const [assignee, setAssignee] = useState([]); // Support Array Multi-Select SDM
  const [kecamatan, setKecamatan] = useState('');

  // Ticker Countdown Real-time (Setiap 1 detik)
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // AUTO CLEANUP: Hapus otomatis tugas jika melewati tanggal 15 bulan berikutnya
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;

    tasks.forEach((task) => {
      const taskTime = task.dueDateTimestamp || new Date(task.dueDateTime || task.dueDate).getTime();
      if (isNaN(taskTime)) return;

      const due = new Date(taskTime);
      const cutoffDate = new Date(due.getFullYear(), due.getMonth() + 1, 15, 23, 59, 59).getTime();

      if (Date.now() > cutoffDate) {
        remove(ref(db, `tasks/${task.id}`))
          .then(() => console.log(`Auto Cleanup: Task ${task.title} dihapus.`))
          .catch((err) => console.error("Cleanup Error:", err));
      }
    });
  }, [tasks]);

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setTitle('');
    setDueDateTime('');
    setTargetType('all');
    setAssignee([]);
    setKecamatan('');
  };

  // Mulai Mode Edit (CRUD - UPDATE)
  const handleStartEdit = (task) => {
    if (!isUserAdmin) return showToast('Akses edit khusus Admin!', 'error');

    setEditingTaskId(task.id);
    setTitle(task.title || '');

    if (task.dueDateTime) {
      const d = new Date(task.dueDateTime);
      if (!isNaN(d.getTime())) {
        const localIsoStr = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDueDateTime(localIsoStr);
      } else {
        setDueDateTime('');
      }
    } else {
      setDueDateTime('');
    }

    setTargetType(task.targetType || 'all');
    
    // Multi-Select Assignee Parsing
    let parsedAssignee = [];
    if (Array.isArray(task.assignee)) {
      parsedAssignee = task.assignee;
    } else if (typeof task.assignee === 'string' && task.assignee.trim()) {
      parsedAssignee = task.assignee.split(',').map((a) => a.trim()).filter(Boolean);
    }
    setAssignee(parsedAssignee);
    setKecamatan(task.kecamatan || '');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Mode Edit: "${task.title}"`, 'info');
  };

  // Handler Toggle Checklist Multi-Select SDM
  const handleAssigneeToggle = (sId) => {
    setAssignee((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      if (current.includes(sId)) {
        return current.filter((id) => id !== sId);
      } else {
        return [...current, sId];
      }
    });
  };

  // Simpan / Edit Tugas (CRUD - CREATE / UPDATE)
  const handleSaveTask = (e) => {
    e.preventDefault();

    if (!title.trim() || !dueDateTime) {
      return showToast('Judul tugas dan tanggal/jam deadline wajib diisi!', 'error');
    }

    if (targetType === 'specific' && (!assignee || (Array.isArray(assignee) && assignee.length === 0))) {
      return showToast('Pilih minimal satu petugas SDM!', 'error');
    }

    if (targetType === 'kecamatan' && !kecamatan.trim()) {
      return showToast('Masukkan nama kecamatan tujuan!', 'error');
    }

    const targetDateObj = new Date(dueDateTime);
    if (isNaN(targetDateObj.getTime())) {
      return showToast('Format tanggal & jam tidak valid!', 'error');
    }

    const taskPayload = {
      title: title.trim(),
      dueDateTime: targetDateObj.toISOString(),
      dueDateTimestamp: targetDateObj.getTime(),
      targetType,
      assignee: targetType === 'specific' ? assignee : [],
      kecamatan: targetType === 'kecamatan' ? kecamatan.trim() : '',
      updatedAt: Date.now()
    };

    if (editingTaskId) {
      // UPDATE
      const existingTask = tasks.find(t => t.id === editingTaskId);
      set(ref(db, `tasks/${editingTaskId}`), {
        ...taskPayload,
        createdAt: existingTask?.createdAt || Date.now(),
        createdByAdmin: existingTask?.createdByAdmin ?? true
      });
      showToast('Tugas berhasil diperbarui!', 'success');
    } else {
      // CREATE
      push(ref(db, 'tasks'), {
        ...taskPayload,
        createdAt: Date.now(),
        createdByAdmin: isUserAdmin
      });
      showToast('Tugas & deadline baru berhasil ditambahkan!', 'success');
    }

    handleCancelEdit();
  };

  // Hapus Tugas (CRUD - DELETE)
  const handleDeleteTask = (id) => {
    if (!isUserAdmin) return showToast('Akses hapus khusus Admin!', 'error');

    if (window.confirm('Apakah Anda yakin ingin menghapus tugas ini secara permanen?')) {
      remove(ref(db, `tasks/${id}`));
      showToast('Tugas berhasil dihapus!', 'info');
      if (editingTaskId === id) handleCancelEdit();
    }
  };

  // EXPORT & IMPORT BACKUP JSON
  const handleExportJSON = () => {
    if (!tasks || tasks.length === 0) {
      return showToast('Tidak ada data tugas untuk di-export!', 'error');
    }
    const cleanTasks = tasks.map(({ id, ...rest }) => rest);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(cleanTasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `Backup_Tugas_PKH_Tapin_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Backup tugas berhasil di-export ke JSON!', 'success');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        if (!Array.isArray(importedData)) {
          return showToast('Format file JSON tidak valid!', 'error');
        }
        let importedCount = 0;
        for (const task of importedData) {
          if (task.title) {
            await push(ref(db, 'tasks'), {
              ...task,
              createdAt: Date.now()
            });
            importedCount++;
          }
        }
        showToast(`Berhasil mengimpor ${importedCount} tugas!`, 'success');
      } catch (err) {
        showToast('Gagal membaca file JSON!', 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Helper Resolver Nama SDM (Support Multi-Select Array & Single String)
  const getStaffName = (id) => {
    if (!id) return '-';
    if (Array.isArray(id)) {
      if (id.length === 0) return '-';
      return id
        .map((singleId) => getStaffName(singleId))
        .filter((name) => name && name !== '-')
        .join(', ');
    }
    const found = staffList.find((s) => s.id === id || s.key === id || s.NAMA === id || s.name === id);
    if (found) return found.name || found.NAMA || found.nama || found.id;
    return id;
  };

  const getCountdown = (targetDateInput) => {
    const targetTime = new Date(targetDateInput).getTime();
    const diff = targetTime - now;

    if (isNaN(targetTime)) {
      return { isExpired: true, text: 'Format Tanggal Salah', badgeClass: 'bg-slate-700 text-slate-300 border-slate-600' };
    }

    if (diff <= 0) {
      return {
        isExpired: true,
        text: 'TERLEWATI',
        days: 0, hours: 0, minutes: 0, seconds: 0,
        badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-500/50 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let badgeClass = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.15)]';
    if (days === 0 && hours < 24) {
      badgeClass = 'bg-amber-950/80 text-amber-300 border-amber-500/50 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.25)]';
    }

    return { isExpired: false, days, hours, minutes, seconds, badgeClass };
  };

  const formatDateTime = (dateInput) => {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const kecamatanListTapin = [
    "Tapin Utara", "Tapin Tengah", "Tapin Selatan", "Candi Laras Utara", 
    "Candi Laras Selatan", "Bakarangan", "Piani", "Lokpaikat", 
    "Hatungun", "Salam Babaris", "Binuang"
  ];

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full">
      {/* Header View & Toolbar - Mobile-First Layout */}
      <div className="p-4 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-900/80 via-slate-900/90 to-purple-900/80 border border-indigo-500/30 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-base sm:text-2xl font-extrabold text-white flex items-center gap-2.5 tracking-wide">
            <FontAwesomeIcon icon={faTasks} className="text-indigo-400 text-lg sm:text-xl" />
            <span>Manajemen Tugas & Deadline SDM</span>
          </h2>
          <p className="text-[11px] sm:text-sm text-indigo-200/80 mt-0.5 leading-snug">
            Sistem penugasan real-time dengan pembersihan otomatis setiap tanggal 15 bulan berikutnya.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={handleExportJSON}
            className="flex-1 md:flex-none justify-center px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95"
          >
            <FontAwesomeIcon icon={faDownload} className="text-emerald-400" />
            <span>Backup JSON</span>
          </button>

          <label className="flex-1 md:flex-none justify-center px-3.5 py-2.5 rounded-2xl bg-indigo-600/40 hover:bg-indigo-600/60 border border-indigo-400/40 text-indigo-100 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95">
            <FontAwesomeIcon icon={faUpload} className="text-indigo-300" />
            <span>Import Template</span>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Form Input / Edit Tugas */}
      <div className={`p-4 sm:p-8 rounded-3xl bg-slate-900/90 border ${editingTaskId ? 'border-amber-500/70 shadow-amber-500/10' : 'border-indigo-500/40'} backdrop-blur-xl shadow-2xl space-y-4 sm:space-y-6 transition-all`}>
        <div className="flex justify-between items-center">
          <h3 className="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
            <FontAwesomeIcon icon={editingTaskId ? faEdit : faPlus} className={editingTaskId ? "text-amber-400" : "text-indigo-400"} />
            <span>{editingTaskId ? 'Edit Detail Tugas & Deadline' : 'Buat Tugas & Deadline Baru'}</span>
          </h3>

          {editingTaskId && (
            <button
              onClick={handleCancelEdit}
              className="px-3 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] sm:text-xs font-semibold flex items-center gap-1 hover:bg-rose-500/30 transition-all cursor-pointer active:scale-95"
            >
              <FontAwesomeIcon icon={faTimes} />
              <span>Batal Edit</span>
            </button>
          )}
        </div>

        <form onSubmit={handleSaveTask} className="space-y-4 sm:space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            <div>
              <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">Judul / Deskripsi Tugas</label>
              <input
                type="text"
                placeholder="Contoh: Pengumpulan Laporan Bulanan KPM"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm outline-none focus:border-indigo-500 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block mb-1.5">Tanggal & Jam Deadline</label>
              <input
                type="datetime-local"
                value={dueDateTime}
                onChange={(e) => setDueDateTime(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm outline-none focus:border-indigo-500 transition-all text-slate-200"
              />
            </div>
          </div>

          {/* Target Penugasan Buttons */}
          <div className="space-y-2.5">
            <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block">Target Penugasan SDM</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer active:scale-[0.98] ${
                  targetType === 'all'
                    ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <FontAwesomeIcon icon={faGlobe} className="text-indigo-400 text-base sm:text-lg shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-xs block text-white truncate">Seluruh SDM</span>
                  <span className="text-[10px] text-slate-400 block truncate">Broadcast semua petugas</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('specific')}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer active:scale-[0.98] ${
                  targetType === 'specific'
                    ? 'bg-emerald-600/30 border-emerald-500 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <FontAwesomeIcon icon={faUser} className="text-emerald-400 text-base sm:text-lg shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-xs block text-white truncate">SDM Tertentu</span>
                  <span className="text-[10px] text-slate-400 block truncate">Multi-select checklist</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTargetType('kecamatan')}
                className={`p-3 sm:p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer active:scale-[0.98] ${
                  targetType === 'kecamatan'
                    ? 'bg-cyan-600/30 border-cyan-500 text-white shadow-md'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-cyan-400 text-base sm:text-lg shrink-0" />
                <div className="min-w-0">
                  <span className="font-bold text-xs block text-white truncate">SDM Per Kecamatan</span>
                  <span className="text-[10px] text-slate-400 block truncate">Target wilayah kecamatan</span>
                </div>
              </button>
            </div>
          </div>

          {/* MULTI-SELECT CHECKLIST UNTUK SDM TERTERTU */}
          {targetType === 'specific' && (
            <div className="animate-fadeIn space-y-2">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block">
                  Pilih Petugas SDM (Checklist Multi-Select)
                </label>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  {Array.isArray(assignee) ? assignee.length : 0} Terpilih
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto p-2.5 rounded-2xl bg-slate-950/80 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 custom-scrollbar">
                {staffList && staffList.length > 0 ? (
                  staffList.map((s, idx) => {
                    const sName = s.name || s.NAMA || s.nama || s.id;
                    const sId = s.id || s.key || sName;
                    const currentAssignees = Array.isArray(assignee) ? assignee : [];
                    const isChecked = currentAssignees.includes(sId) || currentAssignees.includes(sName);

                    return (
                      <label
                        key={sId || idx}
                        className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all active:scale-[0.98] ${
                          isChecked
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                            : 'bg-white/5 border-transparent text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleAssigneeToggle(sId)}
                          className="rounded accent-emerald-500 w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className="truncate">{sName}</span>
                      </label>
                    );
                  })
                ) : (
                  <p className="col-span-full text-slate-500 italic text-xs py-3 text-center">
                    Memuat daftar SDM...
                  </p>
                )}
              </div>
            </div>
          )}

          {targetType === 'kecamatan' && (
            <div className="animate-fadeIn space-y-1.5">
              <label className="text-[11px] sm:text-xs font-semibold text-slate-300 block">Pilih Nama Kecamatan</label>
              <select
                value={kecamatan}
                onChange={(e) => setKecamatan(e.target.value)}
                className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white text-xs sm:text-sm outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="">-- Pilih Kecamatan di Tapin --</option>
                {kecamatanListTapin.map((kec) => (
                  <option key={kec} value={kec}>Kecamatan {kec}</option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-3.5 sm:py-4 rounded-2xl font-extrabold text-xs sm:text-sm text-white shadow-xl transition-all cursor-pointer active:scale-95 ${
              editingTaskId
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500'
            }`}
          >
            {editingTaskId ? 'Perbarui Data Tugas' : 'Simpan & Publish Tugas'}
          </button>
        </form>
      </div>

      {/* Daftar Tugas Aktif */}
      <div className="p-4 sm:p-8 rounded-3xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl space-y-4 sm:space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="text-base sm:text-xl font-bold text-white">
            Daftar Tugas & Deadline Aktif ({tasks.length})
          </h3>

          {/* Indikator Status Admin */}
          {isUserAdmin ? (
            <span className="text-[11px] sm:text-xs text-emerald-300 font-bold flex items-center gap-1.5 bg-emerald-500/20 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-emerald-500/40">
              <FontAwesomeIcon icon={faCheckCircle} className="text-emerald-400" />
              <span>Akses Admin Aktif: Fitur CRUD Terbuka</span>
            </span>
          ) : (
            <span className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1.5 bg-white/5 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full border border-white/10">
              <FontAwesomeIcon icon={faLock} className="text-amber-400" />
              <span>Login Admin di Sidebar untuk mengedit/menghapus</span>
            </span>
          )}
        </div>

        {/* Task Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {tasks.length > 0 ? (
            tasks.map((task) => {
              const countdown = getCountdown(task.dueDateTime || task.dueDate);

              return (
                <div 
                  key={task.id} 
                  className={`p-4 sm:p-5 rounded-3xl bg-white/5 border ${
                    editingTaskId === task.id ? 'border-amber-400 bg-amber-500/10' : 'border-white/10'
                  } flex flex-col justify-between space-y-3 sm:space-y-4 hover:border-indigo-500/40 transition-all shadow-md group active:scale-[0.99]`}
                >
                  <div className="space-y-2.5 sm:space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-white text-xs sm:text-sm leading-snug group-hover:text-indigo-200 transition-colors break-words">
                        {task.title}
                      </h4>
                    </div>

                    <div>
                      {task.targetType === 'all' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-bold">
                          <FontAwesomeIcon icon={faGlobe} /> Seluruh SDM (Broadcast)
                        </span>
                      )}
                      {task.targetType === 'specific' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[10px] font-bold break-words">
                          <FontAwesomeIcon icon={faUser} /> SDM: {getStaffName(task.assignee)}
                        </span>
                      )}
                      {task.targetType === 'kecamatan' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/30 text-cyan-300 text-[10px] font-bold">
                          <FontAwesomeIcon icon={faMapMarkerAlt} /> Kec. {task.kecamatan || '-'}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2.5 sm:pt-3 border-t border-white/10 space-y-2 sm:space-y-3">
                    <div className="flex justify-between items-center text-[11px] sm:text-xs text-slate-300">
                      <span className="flex items-center gap-1.5">
                        <FontAwesomeIcon icon={faCalendarAlt} className="text-indigo-400" />
                        <span>{formatDateTime(task.dueDateTime || task.dueDate)}</span>
                      </span>
                    </div>

                    {/* Countdown Box */}
                    <div className={`p-2.5 rounded-2xl border flex items-center justify-between ${countdown.badgeClass}`}>
                      <span className="text-[10px] sm:text-[11px] font-semibold flex items-center gap-1.5 shrink-0">
                        <FontAwesomeIcon icon={countdown.isExpired ? faExclamationTriangle : faHourglassHalf} />
                        <span>Sisa Waktu:</span>
                      </span>

                      {countdown.isExpired ? (
                        <span className="font-extrabold text-[11px] uppercase tracking-wider text-rose-300">TERLEWATI</span>
                      ) : (
                        <div className="font-mono font-bold text-xs flex gap-1">
                          {countdown.days > 0 && <span>{countdown.days}h</span>}
                          <span>{String(countdown.hours).padStart(2, '0')}j</span>
                          <span>{String(countdown.minutes).padStart(2, '0')}m</span>
                          <span className="w-5 text-right">{String(countdown.seconds).padStart(2, '0')}d</span>
                        </div>
                      )}
                    </div>

                    {/* TOMBOL EDIT & HAPUS (MUNCUL OTOMATIS JIKA ADMIN AKTIF) */}
                    {isUserAdmin && (
                      <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                        <button
                          onClick={() => handleStartEdit(task)}
                          className="flex-1 py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/40 border border-amber-500/50 text-amber-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                          title="Edit tugas ini"
                        >
                          <FontAwesomeIcon icon={faEdit} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="flex-1 py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 border border-rose-500/50 text-rose-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md active:scale-95"
                          title="Hapus tugas ini"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          <span>Hapus</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full text-center py-10 sm:py-12 text-slate-400 italic text-xs sm:text-sm border border-dashed border-white/10 rounded-2xl">
              Belum ada tugas atau deadline yang terdaftar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}