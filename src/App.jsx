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
  faEllipsisH,
  faKey,
  faUserCheck,
  faLock
} from '@fortawesome/free-solid-svg-icons';

// =============================================================================
// MAIN LAYOUT COMPONENT - BASE MOBILE FIRST 2026 & FULL PERSISTENCE & MULTI-ROLE
// Developer: M. Zaen Syachrullah
// =============================================================================
function MainLayout() {
  // ---------------------------------------------------------------------------
  // 1. ROLE & ACCESS CONTROL STATES (PUBLIK | SDM | ADMIN)
  // ---------------------------------------------------------------------------
  const [userRole, setUserRole] = useState(() => {
    const savedRole = localStorage.getItem('userRole');
    if (savedRole && ['public', 'sdm', 'admin'].includes(savedRole)) {
      return savedRole;
    }
    if (localStorage.getItem('isAdmin') === 'true' || localStorage.getItem('adminLoggedIn') === 'true') {
      return 'admin';
    }
    return 'public'; // Default ketika pertama kali dibuka oleh Publik
  });

  const isAdmin = userRole === 'admin';
  const isSdm = userRole === 'sdm';
  const isPublic = userRole === 'public';

  // ---------------------------------------------------------------------------
  // 2. UI & LAYOUT STATES
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'dashboard';
  });

  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // 3. SYSTEM & CONNECTION NETWORK STATES
  // ---------------------------------------------------------------------------
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDbConnected, setIsDbConnected] = useState(true);

  // ---------------------------------------------------------------------------
  // 4. APPLICATION DATA STATES (SINKRON REALTIME FIREBASE)
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

  // Daftar Tab Yang Diperbolehkan Menurut Role
  const getAllowedTabs = (role) => {
    if (role === 'admin') {
      return ['dashboard', 'catatan', 'piket', 'agenda', 'timeline', 'tugas', 'pengaduan', 'sdm'];
    }
    if (role === 'sdm') {
      return ['dashboard', 'piket', 'agenda', 'timeline', 'pengaduan'];
    }
    // Default Publik
    return ['dashboard', 'piket', 'timeline'];
  };

  // Simpan state activeTab & userRole ke LocalStorage + Validasi Akses Tab
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
    localStorage.setItem('userRole', userRole);
    localStorage.setItem('isAdmin', isAdmin ? 'true' : 'false');

    const allowed = getAllowedTabs(userRole);
    if (!allowed.includes(activeTab)) {
      setActiveTab('dashboard');
    }
  }, [userRole, activeTab, isAdmin]);

  // ===========================================================================
  // REALTIME DATABASE & NETWORK LISTENERS
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
      setIsDbConnected(snap.val() === true);
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

    // D. Fetch Schedules
    const schedulesRef = ref(db, 'schedules');
    onValue(schedulesRef, (snapshot) => {
      setSchedules(snapshot.val() || {});
    });

    // E. Fetch Agendas
    const agendasRef = ref(db, 'agendas');
    onValue(agendasRef, (snapshot) => {
      const data = snapshot.val();
      setAgendas(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });

    // F. Fetch Tasks
    const tasksRef = ref(db, 'tasks');
    onValue(tasksRef, (snapshot) => {
      const data = snapshot.val();
      setTasks(data ? Object.entries(data).map(([id, val]) => ({ id, ...val })) : []);
    });

    // G. Fetch Swaps
    const swapsRef = ref(db, 'swaps');
    onValue(swapsRef, (snapshot) => {
      const data = snapshot.val();
      setSwapLogs(data ? Object.values(data) : []);
    });

    // H. Fetch Categories
    const categoriesRef = ref(db, 'categories');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setCategories(Object.values(data));
    });

    // I. Fetch Admin Config
    const configRef = ref(db, 'config');
    onValue(configRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setConfig(data);
        if (data.holidays) setHolidays(data.holidays);
      } else {
        setConfig({});
      }
    });

    // J. Fetch Holidays
    const holidaysRef = ref(db, 'holidays');
    onValue(holidaysRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setHolidays((prev) => ({ ...prev, ...data }));
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // HELPER FUNCTIONS & AUTHENTICATION LOGIC
  // ---------------------------------------------------------------------------
  const handleAddCategory = (newCat) => {
    if (!newCat || newCat.trim() === '') return;
    const updated = [...categories, newCat.trim()];
    set(ref(db, 'categories'), updated);
  };

  // Proses Verifikasi Password (SDM vs Admin)
  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setLoginError('');

    if (loginPassword === 'adminPKH8') {
      setUserRole('admin');
      setIsLoginOpen(false);
      setLoginPassword('');
      if (showToast) showToast('Akses Administrator diberikan!', 'success');
    } else if (loginPassword === 'PKHTapin26') {
      setUserRole('sdm');
      setIsLoginOpen(false);
      setLoginPassword('');
      if (showToast) showToast('Akses Petugas SDM PKH diberikan!', 'success');
    } else {
      setLoginError('Password tidak sesuai. Silakan periksa kembali!');
      if (showToast) showToast('Password Salah!', 'error');
    }
  };

  const handleLogout = () => {
    setUserRole('public');
    localStorage.setItem('userRole', 'public');
    localStorage.setItem('isAdmin', 'false');
    setActiveTab('dashboard');
    if (showToast) showToast('Kembali ke Mode Publik', 'info');
  };

  // Safe Piket & Agenda Hari Ini
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = now.toISOString().split('T')[0];
  const todayPiket = schedules[currentMonthKey]?.[todayStr]?.assigned || [];

  const todayAgenda = agendas.filter((ag) => {
    if (!ag.date) return false;
    const cleanDate = ag.date.includes('T') ? ag.date.split('T')[0] : ag.date;
    return cleanDate === todayStr;
  });

  // BUILD NAV MENU BERDASARKAN ROLE
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: faThLarge },
    ...(isAdmin ? [{ id: 'catatan', label: 'Catatan & Info', icon: faStickyNote }] : []),
    { id: 'piket', label: 'Jadwal Piket', icon: faCalendarAlt },
    ...(isSdm || isAdmin ? [{ id: 'agenda', label: 'Agenda Kerja', icon: faClipboardList }] : []),
    { id: 'timeline', label: 'Timeline 3D', icon: faStream },
    ...(isAdmin ? [{ id: 'tugas', label: 'Tugas & Deadline', icon: faTasks }] : []),
    ...(isSdm || isAdmin ? [{ id: 'pengaduan', label: 'Pengaduan KPM', icon: faHeadset }] : []),
    ...(isAdmin ? [{ id: 'sdm', label: 'Kelola SDM & Config', icon: faUsers }] : [])
  ];

  // QUICK MENU MOBILE BOTTOM BAR
  const getMobileQuickNav = () => {
    if (isAdmin) {
      return [
        { id: 'dashboard', label: 'Beranda', icon: faThLarge },
        { id: 'piket', label: 'Piket', icon: faCalendarAlt },
        { id: 'agenda', label: 'Agenda', icon: faClipboardList },
        { id: 'sdm', label: 'SDM', icon: faUsers }
      ];
    }
    if (isSdm) {
      return [
        { id: 'dashboard', label: 'Beranda', icon: faThLarge },
        { id: 'piket', label: 'Piket', icon: faCalendarAlt },
        { id: 'agenda', label: 'Agenda', icon: faClipboardList },
        { id: 'pengaduan', label: 'Aduan', icon: faHeadset }
      ];
    }
    // Publik
    return [
      { id: 'dashboard', label: 'Beranda', icon: faThLarge },
      { id: 'piket', label: 'Piket', icon: faCalendarAlt },
      { id: 'timeline', label: 'Timeline', icon: faStream }
    ];
  };

  // ===========================================================================
  // RENDER ENGINE
  // ===========================================================================
  return (
    <div className="flex flex-col md:flex-row min-h-screen relative bg-slate-950 text-slate-100 font-sans overflow-x-hidden antialiased">
      
      {/* 3D Glassmorphic Loading Overlay */}
      {isLoading && <GlassLoader text="Menghubungkan ke Realtime Database Firebase..." />}

      {/* MODAL AUTHENTICATION LOGIN ROLE (SDM & ADMIN) */}
      {isLoginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 font-bold">
                  <FontAwesomeIcon icon={faKey} />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Login Mode Akses</h3>
                  <p className="text-[10px] text-slate-400 font-semibold">Masukkan password SDM / Administrator</p>
                </div>
              </div>
              <button 
                onClick={() => { setIsLoginOpen(false); setLoginError(''); setLoginPassword(''); }}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">Kata Kunci / Password Akses</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-500 text-xs">
                    <FontAwesomeIcon icon={faLock} />
                  </span>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Masukkan password..."
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-white/15 rounded-2xl text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
                {loginError && <p className="text-xs text-rose-400 font-bold mt-2">{loginError}</p>}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-[11px] text-slate-400 space-y-1">
                <p><span className="text-emerald-400 font-bold">● Petugas SDM:</span> Bebas mengelola agenda & pengaduan.</p>
                <p><span className="text-amber-400 font-bold">● Administrator:</span> Akses penuh seluruh sistem.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsLoginOpen(false); setLoginError(''); setLoginPassword(''); }}
                  className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs shadow-3d-button transition-all cursor-pointer"
                >
                  Masuk Akses
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBILE TOP HEADER */}
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

      {/* SIDEBAR NAVIGATION */}
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
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs ${
              isAdmin ? 'bg-amber-500/20 text-amber-400' : isSdm ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'
            }`}>
              <FontAwesomeIcon icon={isAdmin ? faShieldAlt : isSdm ? faUserCheck : faUsers} />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-semibold block uppercase">Mode Akses</span>
              <span className="text-xs font-bold text-white truncate block">
                {isAdmin ? 'Administrator' : isSdm ? 'Petugas SDM PKH' : 'Publik / Visitor'}
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

          {/* Login / Logout Multi-Role Button */}
          {!isPublic ? (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer bg-rose-950/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/60 shadow-md"
            >
              <FontAwesomeIcon icon={faUserLock} />
              <span>Keluar Mode ({isAdmin ? 'Admin' : 'SDM'})</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsLoginOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl border border-indigo-500/30 bg-indigo-950/40 text-indigo-300 hover:bg-indigo-900/60 text-xs font-extrabold transition-all cursor-pointer shadow-md"
            >
              <FontAwesomeIcon icon={faUserLock} />
              <span>Masuk SDM / Admin</span>
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
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
            isSdm={isSdm}
            userRole={userRole}
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
            isSdm={isSdm}
          />
        )}

        {activeTab === 'agenda' && (isSdm || isAdmin) && (
          <AgendaView
            agendas={agendas}
            categories={categories}
            onAddCategory={handleAddCategory}
            isAdmin={isAdmin || isSdm} // SDM & Admin memiliki hak mengelola kegiatan
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

        {activeTab === 'tugas' && isAdmin && (
          <TugasView
            tasks={tasks}
            staffList={staffList}
            isAdmin={isAdmin}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

        {activeTab === 'pengaduan' && (isSdm || isAdmin) && (
          <PengaduanView
            staffList={staffList}
            isAdmin={isAdmin || isSdm}
          />
        )}

        {activeTab === 'sdm' && isAdmin && (
          <SdmManagementView
            staffList={staffList}
            config={config}
            holidays={holidays}
            isAdmin={isAdmin}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

      </main>

      {/* FLOATING MOBILE BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-3 left-3 right-3 z-40 bg-slate-900/95 border border-white/15 backdrop-blur-2xl rounded-2xl px-2 py-1.5 flex items-center justify-around shadow-[0_10px_30px_rgba(0,0,0,0.8)]">
        {getMobileQuickNav().map((item) => (
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