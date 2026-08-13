import React, { useState, useEffect } from 'react';
import { db, ref, push, set, remove, update, onValue } from '../firebase';
import { useToast } from '../context/ToastContext';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faStickyNote, 
  faBullhorn, 
  faPlus, 
  faTrashAlt, 
  faTimes, 
  faSave, 
  faCalendarAlt,
  faEdit,
  faShieldAlt,
  faCheckCircle,
  faInfoCircle
} from '@fortawesome/free-solid-svg-icons';

export default function CatatanView({ isAdmin }) {
  const { showToast } = useToast();

  const [infoList, setInfoList] = useState([]);
  const [isAddInfoModalOpen, setIsAddInfoModalOpen] = useState(false);
  const [isEditInfoModalOpen, setIsEditInfoModalOpen] = useState(false);
  const [infoForm, setInfoForm] = useState({ title: '', content: '' });
  const [editingInfo, setEditingInfo] = useState(null);

  const [notesList, setNotesList] = useState([]);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);
  const [isEditNoteModalOpen, setIsEditNoteModalOpen] = useState(false);
  const [noteForm, setNoteForm] = useState({ title: '', content: '' });
  const [editingNote, setEditingNote] = useState(null);

  // Format Tanggal Resmi: dddd, dd mmmm yyyy
  const getFormattedIndoDate = () => {
    const d = new Date();
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  // Listen Realtime Papan Pengumuman
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

  // Listen Realtime Catatan Operasional
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

  // CRUD HANDLERS PENGUMUMAN
  const handleAddInfo = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (!infoForm.title || !infoForm.content) return showToast('Harap isi judul dan isi pengumuman!', 'error');

    try {
      const newRef = push(ref(db, 'infoList'));
      await set(newRef, {
        title: infoForm.title,
        content: infoForm.content,
        timestamp: Date.now(),
        dateStr: getFormattedIndoDate()
      });
      showToast('Pengumuman baru berhasil diterbitkan!', 'success');
      setInfoForm({ title: '', content: '' });
      setIsAddInfoModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menerbitkan. Pastikan Rules Realtime Database diatur write: true', 'error');
    }
  };

  const handleEditInfoClick = (info) => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    setEditingInfo({ ...info });
    setIsEditInfoModalOpen(true);
  };

  const handleSaveEditedInfo = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (!editingInfo || !editingInfo.id) return;

    try {
      await update(ref(db, `infoList/${editingInfo.id}`), {
        title: editingInfo.title,
        content: editingInfo.content
      });
      showToast('Pengumuman berhasil diperbarui!', 'success');
      setIsEditInfoModalOpen(false);
      setEditingInfo(null);
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui pengumuman.', 'error');
    }
  };

  const handleDeleteInfo = async (infoId) => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (window.confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) {
      try {
        await remove(ref(db, `infoList/${infoId}`));
        showToast('Pengumuman berhasil dihapus!', 'info');
      } catch (err) {
        console.error(err);
        showToast('Gagal menghapus pengumuman.', 'error');
      }
    }
  };

  // CRUD HANDLERS CATATAN
  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (!noteForm.title || !noteForm.content) return showToast('Harap isi judul dan isi catatan!', 'error');

    try {
      const newRef = push(ref(db, 'dashboardNotes'));
      await set(newRef, {
        title: noteForm.title,
        content: noteForm.content,
        timestamp: Date.now(),
        dateStr: getFormattedIndoDate()
      });
      showToast('Catatan SDM berhasil ditambahkan!', 'success');
      setNoteForm({ title: '', content: '' });
      setIsAddNoteModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Gagal menambahkan catatan. Pastikan Rules Realtime Database diatur write: true', 'error');
    }
  };

  const handleEditNoteClick = (note) => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    setEditingNote({ ...note });
    setIsEditNoteModalOpen(true);
  };

  const handleSaveEditedNote = async (e) => {
    e.preventDefault();
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (!editingNote || !editingNote.id) return;

    try {
      await update(ref(db, `dashboardNotes/${editingNote.id}`), {
        title: editingNote.title,
        content: editingNote.content
      });
      showToast('Catatan berhasil diperbarui!', 'success');
      setIsEditNoteModalOpen(false);
      setEditingNote(null);
    } catch (err) {
      console.error(err);
      showToast('Gagal memperbarui catatan.', 'error');
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!isAdmin) return showToast('Akses khusus Admin!', 'error');
    if (window.confirm('Apakah Anda yakin ingin menghapus catatan ini?')) {
      try {
        await remove(ref(db, `dashboardNotes/${noteId}`));
        showToast('Catatan berhasil dihapus!', 'info');
      } catch (err) {
        console.error(err);
        showToast('Gagal menghapus catatan.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-fadeIn max-w-full">
      {/* Header Banner - Cyberpunk 2070 Futuristic Glassmorphism */}
      <div className="p-4 sm:p-8 rounded-3xl bg-gradient-to-r from-indigo-950/90 via-slate-900/95 to-amber-950/90 border border-amber-500/40 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden transition-all duration-300">
        <div className="z-10 space-y-1.5 max-w-full">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <FontAwesomeIcon icon={faShieldAlt} /> MODUL ADMIN KHUSUS
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black text-white tracking-wide leading-snug flex items-center gap-2.5">
            <FontAwesomeIcon icon={faStickyNote} className="text-amber-400 text-lg sm:text-2xl" />
            <span>Pusat Catatan & Pengumuman SDM</span>
          </h1>
          <p className="text-xs sm:text-sm text-amber-200/80 leading-tight">
            Kelola pengumuman resmi dan catatan operasional khusus Administrator
          </p>
        </div>

        {isAdmin && (
          <div className="z-10 flex gap-2.5 sm:gap-3 flex-wrap w-full md:w-auto">
            <button
              onClick={() => setIsAddInfoModalOpen(true)}
              className="flex-1 md:flex-none justify-center px-4 py-3 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-extrabold text-xs shadow-[0_10px_25px_rgba(245,158,11,0.3)] flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <FontAwesomeIcon icon={faBullhorn} />
              <span>+ Buat Pengumuman</span>
            </button>

            <button
              onClick={() => setIsAddNoteModalOpen(true)}
              className="flex-1 md:flex-none justify-center px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-extrabold text-xs shadow-[0_10px_25px_rgba(99,102,241,0.3)] flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>+ Buat Catatan</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
        {/* PANEL 1: PAPAN PENGUMUMAN (FULL CRUD ADMIN) */}
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-amber-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faBullhorn} className="text-amber-400" />
              <span>Papan Pengumuman Resmi</span>
            </h3>
            <span className="text-[10px] sm:text-xs text-amber-300 font-extrabold bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
              {infoList.length} Diterbitkan
            </span>
          </div>

          <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
            {infoList.length > 0 ? (
              infoList.map((info) => (
                <div key={info.id} className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 relative group hover:border-amber-500/50 transition-all duration-300 space-y-3 active:scale-[0.99]">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-amber-300 text-xs sm:text-sm leading-snug break-words">{info.title}</h4>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 bg-slate-900 px-2 py-1 rounded-lg border border-white/5">
                      <FontAwesomeIcon icon={faCalendarAlt} /> {info.dateStr || '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words">{info.content}</p>

                  {isAdmin && (
                    <div className="pt-2 border-t border-white/10 flex justify-end gap-3">
                      <button
                        onClick={() => handleEditInfoClick(info)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteInfo(info.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                      >
                        <FontAwesomeIcon icon={faTrashAlt} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-500 py-12 italic">Belum ada pengumuman resmi diterbitkan.</p>
            )}
          </div>
        </div>

        {/* PANEL 2: CATATAN OPERASIONAL SDM (FULL CRUD ADMIN) */}
        <div className="p-4 sm:p-6 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-white/10">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faStickyNote} className="text-indigo-400" />
              <span>Catatan Operasional SDM</span>
            </h3>
            <span className="text-[10px] sm:text-xs text-indigo-300 font-extrabold bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-500/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]">
              {notesList.length} Catatan
            </span>
          </div>

          <div className="space-y-3.5 max-h-[520px] overflow-y-auto pr-1 custom-scrollbar">
            {notesList.length > 0 ? (
              notesList.map((note) => (
                <div key={note.id} className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-white/10 relative group hover:border-indigo-500/50 transition-all duration-300 space-y-3 active:scale-[0.99]">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="font-bold text-indigo-300 text-xs sm:text-sm leading-snug break-words">{note.title}</h4>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0 bg-slate-900 px-2 py-1 rounded-lg border border-white/5">
                      <FontAwesomeIcon icon={faCalendarAlt} /> {note.dateStr || '-'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed break-words">{note.content}</p>

                  {isAdmin && (
                    <div className="pt-2 border-t border-white/10 flex justify-end gap-3">
                      <button
                        onClick={() => handleEditNoteClick(note)}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                      >
                        <FontAwesomeIcon icon={faEdit} />
                        <span>Edit</span>
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-rose-400 hover:text-rose-300 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors active:scale-95"
                      >
                        <FontAwesomeIcon icon={faTrashAlt} />
                        <span>Hapus</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-center text-xs text-slate-500 py-12 italic">Belum ada catatan operasional ditambahkan.</p>
            )}
          </div>
        </div>
      </div>

      {/* MODAL TAMBAH PENGUMUMAN */}
      {isAdmin && isAddInfoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl bg-slate-900 border border-amber-500/50 shadow-2xl relative space-y-4 sm:space-y-5 animate-fadeIn my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsAddInfoModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faBullhorn} className="text-amber-400" />
              <span>Terbitkan Pengumuman Baru</span>
            </h3>

            <form onSubmit={handleAddInfo} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  placeholder="Contoh: Pengumuman Rapat Koordinasi"
                  value={infoForm.title}
                  onChange={(e) => setInfoForm({ ...infoForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Isi Detail Pengumuman</label>
                <textarea
                  rows="4"
                  placeholder="Tuliskan isi pengumuman lengkap..."
                  value={infoForm.content}
                  onChange={(e) => setInfoForm({ ...infoForm, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddInfoModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                >
                  <FontAwesomeIcon icon={faSave} />
                  <span>Terbitkan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT PENGUMUMAN */}
      {isAdmin && isEditInfoModalOpen && editingInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl bg-slate-900 border border-amber-500/50 shadow-2xl relative space-y-4 sm:space-y-5 animate-fadeIn my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => { setIsEditInfoModalOpen(false); setEditingInfo(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faEdit} className="text-amber-400" />
              <span>Edit Pengumuman</span>
            </h3>

            <form onSubmit={handleSaveEditedInfo} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Judul Pengumuman</label>
                <input
                  type="text"
                  value={editingInfo.title || ''}
                  onChange={(e) => setEditingInfo({ ...editingInfo, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Isi Pengumuman</label>
                <textarea
                  rows="4"
                  value={editingInfo.content || ''}
                  onChange={(e) => setEditingInfo({ ...editingInfo, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-amber-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { setIsEditInfoModalOpen(false); setEditingInfo(null); }}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                >
                  <FontAwesomeIcon icon={faSave} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH CATATAN */}
      {isAdmin && isAddNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl bg-slate-900 border border-indigo-500/50 shadow-2xl relative space-y-4 sm:space-y-5 animate-fadeIn my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setIsAddNoteModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faStickyNote} className="text-indigo-400" />
              <span>Tambah Catatan Operasional SDM</span>
            </h3>

            <form onSubmit={handleAddNote} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Judul Catatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Prosedur Pengarsipan Laporan"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm({ ...noteForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Isi Catatan</label>
                <textarea
                  rows="4"
                  placeholder="Tuliskan isi catatan operasional..."
                  value={noteForm.content}
                  onChange={(e) => setNoteForm({ ...noteForm, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddNoteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                >
                  <FontAwesomeIcon icon={faSave} />
                  <span>Simpan Catatan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT CATATAN */}
      {isAdmin && isEditNoteModalOpen && editingNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto custom-scrollbar">
          <div className="w-full max-w-md p-5 sm:p-8 rounded-3xl bg-slate-900 border border-indigo-500/50 shadow-2xl relative space-y-4 sm:space-y-5 animate-fadeIn my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => { setIsEditNoteModalOpen(false); setEditingNote(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white cursor-pointer"
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>

            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <FontAwesomeIcon icon={faEdit} className="text-indigo-400" />
              <span>Edit Catatan Operasional SDM</span>
            </h3>

            <form onSubmit={handleSaveEditedNote} className="space-y-3.5 sm:space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Judul Catatan</label>
                <input
                  type="text"
                  value={editingNote.title || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Isi Catatan</label>
                <textarea
                  rows="4"
                  value={editingNote.content || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs outline-none focus:border-indigo-500"
                ></textarea>
              </div>

              <div className="flex justify-end gap-2.5 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => { setIsEditNoteModalOpen(false); setEditingNote(null); }}
                  className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-semibold cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
                >
                  <FontAwesomeIcon icon={faSave} />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}