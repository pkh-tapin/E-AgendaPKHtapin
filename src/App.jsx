import React, { useState, useEffect } from 'react';
import { db, ref, onValue, set } from './firebase';
import { ToastProvider, useToast } from './context/ToastContext';
import Dashboard from './views/Dashboard';
import PiketView from './views/PiketView';
import AgendaView from './views/AgendaView';
import TugasView from './views/TugasView';
import SdmManagementView from './views/SdmManagementView';
import TimelineView from './views/TimelineView';
import CatatanView from './views/CatatanView';
import PengaduanView from './views/Pengaduan';
import AdminLoginModal from './components/AdminLoginModal';
import GlassLoader from './components/GlassLoader';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faThLarge, 
  faCalendarAlt, 
  faClipboardList, 
  faTasks, 
  faUsers, 
  faUserLock, 
  faStream,
  faBars,
  faTimes,
  faWifi,
  faServer,
  faStickyNote,
  faHeadset,
  faShieldAlt,
  faCircle,
  faEllipsisH
} from '@fortawesome/free-solid-svg-icons';

// =============================================================================
// MAIN LAYOUT COMPONENT - BASE MOBILE FIRST 2026 & FULL PERSISTENCE
// Developer: M. Zaen Syachrullah
// =============================================================================
function MainLayout() {
  // ---------------------------------------------------------------------------
  // 1. UI & LAYOUT STATES (SINKRON FULL PERSISTENCE DENGAN LOCALSTORAGE)
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });

  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('adminLoggedIn') === 'true';
  });

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. SYSTEM & CONNECTION NETWORK STATES
  // ---------------------------------------------------------------------------
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDbConnected, setIsDbConnected] = useState(true);

  // ---------------------------------------------------------------------------
  // 3. APPLICATION DATA STATES (MURNI SINKRON REALTIME FIREBASE)
  // ---------------------------------------------------------------------------
  const [staffList, setStaffList] = useState([]);
  const [schedules, setSchedules] = useState({});
  const [agendas, setAgendas] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [swapLogs, setSwapLogs] = useState([]);
  const [categories, setCategories] = useState(['Rapat', 'Sosialisasi', 'Monev', 'Penyuluhan']);
  const [config, setConfig] = useState({});
  const [holidays, setHolidays] = useState({});

  const { showToast } = useToast();

  // Simpan state activeTab ke LocalStorage agar saat REFRESH tetap di halaman yang sama
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  // Simpan/Sinkronkan state isAdmin ke LocalStorage & Reset tab jika logout dari admin
  useEffect(() => {
    localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');
    if (!isAdmin && activeTab === 'catatan') {
      setActiveTab('dashboard');
    }
  }, [isAdmin, activeTab]);

  // ===========================================================================
  // REALTIME DATABASE & NETWORK LISTENERS (DEPENDENCY [] -> NO INFINITE LOOP)
  // ===========================================================================
  useEffect(() => {
    // A. Network Status Listeners
    const handleOnline = () => {
      setIsOnline(true);
      if (showToast) showToast('Koneksi internet kembali pulih.', 'success');
    };
    const handleOffline = () => {
      setIsOnline(false);
      if (showToast) showToast('Koneksi internet terputus! Mode offline.', 'error');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // B. Firebase Connection State
    const connectedRef = ref(db, '.info/connected');
    onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setIsDbConnected(true);
      } else {
        setIsDbConnected(false);
      }
    });

    // C. Fetch Staff / SDM Data
    const staffRef = ref(db, 'staff');
    onValue(staffRef, (snapshot) => {
      try {
        const data = snapshot.val();
        if (data && typeof data === 'object') {
          const parsedStaff = Object.entries(data).map(([id, val]) => {
            if (typeof val === 'string') return { id, name: val, NAMA: val };
            return { id, ...val, name: val.name || val.nama || val.NAMA || id };
          });
          setStaffList(parsedStaff);
        } else {
          setStaffList([]);
        }
      } catch (error) {
        console.error("Error parsing staff data:", error);
        setStaffList([]);
      } finally {
        setIsLoading(false);
      }
    });

    // D. Fetch Schedules (Jadwal Piket Bulanan)
    const schedulesRef = ref(db, 'schedules');
    onValue(schedulesRef, (snapshot) => {
      const data = snapshot.val();
      setSchedules(data || {});
    });

    // E. Fetch Agendas (Agenda Kerja Harian)
    const agendasRef = ref(db, 'agendas');
    onValue(agendasRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAgendas(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      } else {
        setAgendas([]);
      }
    });

    // F. Fetch Tasks (Tugas & Deadline Countdowns)
    const tasksRef = ref(db, 'tasks');
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setTasks(Object.entries(data).map(([id, val]) => ({ id, ...val })));
      } else {
        setTasks([]);
      }
    });

    // G. Fetch Swaps (Riwayat Pertukaran Piket)
    const swapsRef = ref(db, 'swaps');
    onValue(swapsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setSwapLogs(Object.values(data));
      } else {
        setSwapLogs([]);
      }
    });

    // H. Fetch Categories (Kategori Kegiatan)
    const categoriesRef = ref(db, 'categories');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setCategories(Object.values(data));
      }
    });

    // I. Fetch Admin Config (Pengaturan & Aturan Piket)
    const configRef = ref(db, 'config');
    onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setConfig(data);
        if (data.holidays) {
          setHolidays(data.holidays);
        }
      } else {
        setConfig({});
      }
    });

    // J. Fetch Holidays (Tanggal Merah)
    const holidaysRef = ref(db, 'holidays');
    onValue(holidaysRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setHolidays((prev) => ({ ...prev, ...data }));
      }
    });

    // Cleanup Listeners saat Unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // HELPER FUNCTIONS
  // ---------------------------------------------------------------------------
  const handleAddCategory = (newCat) => {
    if (!newCat || newCat.trim() === '') return;
    const updated = [...categories, newCat.trim()];
    set(ref(db, 'categories'), updated);
  };

  // Safe Piket Hari Ini
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = now.toISOString().split('T')[0];
  const todayPiket = schedules[currentMonthKey]?.[todayStr]?.assigned || [];

  // Safe Agenda Hari Ini
  const todayAgenda = agendas.filter((ag) => {
    if (!ag.date) return false;
    const cleanDate = ag.date.includes('T') ? ag.date.split('T')[0] : ag.date;
    return cleanDate === todayStr;
  });

  // NAV MENU BUILDER (DESKTOP & MOBILE DRAWER)
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: faThLarge },
    ...(isAdmin ? [{ id: 'catatan', label: 'Catatan & Info', icon: faStickyNote }] : []),
    { id: 'piket', label: 'Jadwal Piket', icon: faCalendarAlt },
    { id: 'agenda', label: 'Agenda Kerja', icon: faClipboardList },
    { id: 'timeline', label: 'Timeline 3D', icon: faStream },
    { id: 'tugas', label: 'Tugas & Deadline', icon: faTasks },
    { id: 'pengaduan', label: 'Pengaduan KPM', icon: faHeadset },
    { id: 'sdm', label: 'Kelola SDM & Config', icon: faUsers }
  ];

  // FLOATING BOTTOM BAR NAVIGATION (MOBILE QUICK MENU)
  const mobileQuickNav = [
    { id: 'dashboard', label: 'Beranda', icon: faThLarge },
    { id: 'piket', label: 'Piket', icon: faCalendarAlt },
    { id: 'agenda', label: 'Agenda', icon: faClipboardList },
    { id: 'sdm', label: 'SDM', icon: faUsers }
  ];

  // ===========================================================================
  // RENDER ENGINE
  // ===========================================================================
  return (
    <div className="flex flex-col md:flex-row min-h-screen relative bg-slate-950 text-slate-100 font-sans overflow-x-hidden antialiased">
      
      {/* 3D Glassmorphic Loading Overlay */}
      {isLoading && <GlassLoader text="Menghubungkan ke Realtime Database Firebase..." />}

      {/* Global Administrator Login Modal */}
      <AdminLoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onSuccess={() => {
          setIsAdmin(true);
          localStorage.setItem('isAdmin', 'true');
          if (showToast) showToast('Berhasil masuk sebagai Administrator!', 'success');
        }}
      />

      {/* MOBILE TOP HEADER (LAYOUT SIMETRIS ANTI-OVERFLOW) */}
      <header className="md:hidden flex items-center justify-between px-3.5 py-2.5 bg-slate-950/95 border-b border-white/10 sticky top-0 z-30 backdrop-blur-2xl shadow-md w-full">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-black text-xs text-white shadow-3d-button shrink-0">
            P
          </div>
          <div className="min-w-0 truncate">
            <span className="font-extrabold text-xs text-white tracking-wider block leading-tight truncate">SDM PKH</span>
            <span className="text-[9px] text-indigo-400 font-bold block uppercase tracking-wider leading-none truncate">TAPIN REGENCY</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-2">
          {/* Status Realtime Mobile Indicator */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[9px] font-bold">
            <FontAwesomeIcon 
              icon={faCircle} 
              className={`text-[6px] animate-pulse ${isOnline && isDbConnected ? 'text-emerald-400' : 'text-rose-500'}`} 
            />
            <span className="text-slate-300">{isOnline && isDbConnected ? 'Live' : 'Off'}</span>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white text-xs flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            aria-label="Toggle Menu Drawer"
          >
            <FontAwesomeIcon icon={isMobileMenuOpen ? faTimes : faBars} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* SIDEBAR NAVIGATION (DESKTOP & MOBILE DRAWER) */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-64 bg-slate-950/95 md:bg-slate-950/80 border-r border-white/10 p-5 md:p-6 flex flex-col justify-between backdrop-blur-2xl transition-transform duration-300 ease-out shadow-2xl md:shadow-none ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Logo Brand Desktop */}
          <div className="hidden md:flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-black text-xl text-white shadow-3d-glass">
              P
            </div>
            <div>
              <span className="font-extrabold text-base text-white tracking-wider block leading-tight">SDM PKH</span>
              <span className="text-[10px] text-indigo-400 font-bold block uppercase tracking-widest">Kabupaten Tapin</span>
            </div>
          </div>

          {/* User Role Badge Indicator */}
          <div className="p-3 rounded-2xl bg-gradient-to-r from-indigo-950/50 to-slate-900/50 border border-indigo-500/20 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs ${isAdmin ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
              <FontAwesomeIcon icon={isAdmin ? faShieldAlt : faUsers} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mode Akses</span>
              <span className="text-xs font-bold text-white truncate block">
                {isAdmin ? 'Administrator' : 'SDM / Public Viewer'}
              </span>
            </div>
          </div>

          {/* Navigation Menu Buttons */}
          <nav className="space-y-1.5 custom-scrollbar max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                  activeTab === item.id
                    ? 'bg-indigo-600 text-white shadow-3d-button translate-x-1'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className={`w-4 h-4 ${activeTab === item.id ? 'text-white' : 'text-indigo-400/80'}`} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Bottom Section Sidebar */}
        <div className="pt-4 space-y-3 border-t border-white/10">
          {/* Status System Indicators (Desktop) */}
          <div className="hidden md:flex items-center justify-between px-2 text-[10px] font-bold uppercase text-slate-400">
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faWifi} className={isOnline ? 'text-emerald-400' : 'text-rose-400'} />
              {isOnline ? 'Online' : 'Offline'}
            </span>
            <span className="flex items-center gap-1.5">
              <FontAwesomeIcon icon={faServer} className={isDbConnected ? 'text-cyan-400' : 'text-amber-400'} />
              {isDbConnected ? 'DB Active' : 'Connecting'}
            </span>
          </div>

          {/* Admin Toggle Button */}
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              if (isAdmin) {
                setIsAdmin(false);
                localStorage.setItem('isAdmin', 'false');
                if (showToast) showToast('Keluar dari mode Administrator', 'info');
              } else {
                setIsLoginOpen(true);
              }
            }}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer shadow-md ${
              isAdmin
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/60'
                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            <FontAwesomeIcon icon={faUserLock} />
            <span>{isAdmin ? 'Admin Aktif (Keluar)' : 'Masuk Mode Admin'}</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA (DENGAN pb-28 UNTUK SCROLL CLEARANCE DI MOBILE) */}
      <main className="flex-1 p-3.5 sm:p-6 md:p-8 overflow-y-auto max-w-full min-h-screen pb-28 md:pb-8">
        
        {activeTab === 'dashboard' && (
          <Dashboard
            todayPiket={todayPiket}
            todayAgenda={todayAgenda}
            agendas={agendas}
            swapLogs={swapLogs}
            tasks={tasks}
            staffList={staffList}
            config={config}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'catatan' && isAdmin && (
          <CatatanView isAdmin={isAdmin} />
        )}

        {activeTab === 'piket' && (
          <PiketView
            schedules={schedules}
            staffList={staffList}
            config={config}
            holidays={holidays}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'agenda' && (
          <AgendaView
            agendas={agendas}
            categories={categories}
            onAddCategory={handleAddCategory}
            isAdmin={isAdmin}
            staffList={staffList}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineView
            agendas={agendas}
            tasks={tasks}
            staffList={staffList}
          />
        )}

        {activeTab === 'tugas' && (
          <TugasView
            tasks={tasks}
            staffList={staffList}
            isAdmin={isAdmin}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

        {activeTab === 'pengaduan' && (
          <PengaduanView
            staffList={staffList}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === 'sdm' && (
          <SdmManagementView
            staffList={staffList}
            config={config}
            holidays={holidays}
            isAdmin={isAdmin}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

      </main>

      {/* FLOATING MOBILE BOTTOM NAVIGATION BAR (2026 MOBILE UX PERFECT) */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900/95 border border-white/15 backdrop-blur-2xl rounded-2xl px-2 py-1.5 flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
        {mobileQuickNav.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setActiveTab(item.id);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === item.id
                ? 'text-indigo-400 font-extrabold scale-105'
                : 'text-slate-400 hover:text-white font-semibold'
            }`}
          >
            <FontAwesomeIcon icon={item.icon} className="text-sm" />
            <span className="text-[9px] leading-none">{item.label}</span>
          </button>
        ))}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 py-1 px-2.5 text-slate-400 hover:text-white font-semibold cursor-pointer"
        >
          <FontAwesomeIcon icon={faEllipsisH} className="text-sm" />
          <span className="text-[9px] leading-none">Menu</span>
        </button>
      </div>

    </div>
  );
}

// APP INITIALIZER
export default function App() {
  return (
    <ToastProvider>
      <MainLayout />
    </ToastProvider>
  );
}