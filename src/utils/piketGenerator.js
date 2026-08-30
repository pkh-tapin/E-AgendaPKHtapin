/**
 * =============================================================================
 * BLUEPRINT ENGINE: GENERATE MONTHLY SCHEDULE SDM PKH TAPIN
 * Developer: M. Zaen Syachrullah
 * 
 * ATURAN DAN LOGIKA BISNIS PIKET RESMI:
 * 1. Target Periode: Dinamis berdasarkan parameter bulan dan tahun input admin.
 * 2. Hari Kerja Efektif: Hanya Senin sampai Jumat (Sabtu & Minggu libur).
 * 3. Hari Libur Resmi (Holidays): Tanggal merah dikosongkan (assigned = []).
 * 4. Jarak Interval Piket 1 & Piket 2 (Spacing):
 *    - Required Interval = Total Hari Kerja Efektif / 2.
 *    - Garansi piket 1 dan piket 2 tidak akan berdekatan.
 * 5. Variasi Pasangan Petugas (Anti-Duplikasi Pasangan):
 *    - Jika SDM A & SDM B pernah piket bersama di piket ke-1, maka pada piket ke-2
 *      MEREKA WAJIB DIPISAHKAN dan dipasangkan dengan SDM lain agar adil.
 * 6. Garansi Kuota Harian:
 *    - SENIN        : STRICTLY TERBANYAK (Minimal 3, jadi wadah untuk surplus).
 *    - SELASA-KAMIS : Kuota standar (Minimal 2).
 *    - JUMAT        : KUNCI MATI maksimal 2 orang.
 *    - ATURAN BARU  : Petugas tidak boleh mendapat hari (Senin-Jumat) yang sama untuk piket ke-1 dan ke-2.
 * =============================================================================
 */

// DAFTAR NAMA DUMMY LEGACY UNTUK DISARING DARI GENERATOR PIKET
const DUMMY_SAMPLE_NAMES = ['ahmad', 'budi', 'siti', 'dewi', 'eko', 'fajar', 'gita', 'hadi'];

export function generateMonthlySchedule(year, month, staffList = [], config = {}, holidays = {}) {
  const now = new Date();
  let targetYear = Number(year);
  let targetMonth = Number(month);

  if (!targetYear || !targetMonth || isNaN(targetYear) || isNaN(targetMonth)) {
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    targetYear = nextMonthDate.getFullYear();
    targetMonth = nextMonthDate.getMonth() + 1;
  }

  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const workDays = [];

  const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const namaBulan = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  let currentWeek = 1;

  // ---------------------------------------------------------------------------
  // 1. STRUKTURISASI HARI KERJA (SENIN - JUMAT)
  // ---------------------------------------------------------------------------
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(targetYear, targetMonth - 1, d);
    const dayOfWeek = dateObj.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) { 
      const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const formattedLabel = `${d} ${namaBulan[targetMonth - 1]} ${targetYear}`;
      const dayName = namaHari[dayOfWeek];

      if (dayOfWeek === 1 && workDays.length > 0) {
        currentWeek++;
      }

      const isHoliday = !!(holidays && holidays[dateStr]);
      const holidayTitle = isHoliday 
        ? (typeof holidays[dateStr] === 'string' ? holidays[dateStr] : 'Hari Libur Resmi') 
        : '';

      workDays.push({
        dateStr,
        formattedLabel,
        dayName,
        dayNumber: d,
        dayOfWeek,
        weekIndex: currentWeek,
        isHoliday,
        holidayTitle,
        assigned: []
      });
    }
  }

  const validDays = workDays.filter((d) => !d.isHoliday);
  const totalEffectiveDays = validDays.length;

  // ---------------------------------------------------------------------------
  // SANITASI & FILTER SDM MURNI DARI DATABASE
  // ---------------------------------------------------------------------------
  const cleanStaffList = (staffList || []).map((s, idx) => {
    if (typeof s === 'string') return { id: String(idx), name: s, isDummyString: true };
    const realId = s.id || s.key || s._id || String(idx);
    return { ...s, id: String(realId), name: s.name || s.nama || '' };
  }).filter((s) => {
    if (!s || !s.name || typeof s.name !== 'string' || s.name.trim() === '') return false;
    if (s.isDummyString) return false;

    const lowerName = s.name.toLowerCase().trim();
    const isSampleName = DUMMY_SAMPLE_NAMES.includes(lowerName);
    const isLegacyId = !s.id || s.id.length < 5 || /^s\d+$/i.test(s.id);
    const hasNoDetails = (!s.nik || s.nik === '-') && (!s.phone || s.phone === '-');

    if (isSampleName && (isLegacyId || hasNoDetails)) return false;
    return true;
  });

  const totalSdm = cleanStaffList.length;

  if (totalEffectiveDays === 0 || totalSdm === 0) {
    const emptyResult = {};
    workDays.forEach((d) => { emptyResult[d.dateStr] = { ...d, assigned: [] }; });
    return emptyResult;
  }

  // ---------------------------------------------------------------------------
  // 2. PENETAPAN ATURAN TARGET & INTERVAL KUNCI MATI
  // ---------------------------------------------------------------------------
  const minWorkdaysThreshold = Number(config.minWorkdaysForDoublePiket) || 13;
  const targetPerStaff = totalEffectiveDays > minWorkdaysThreshold ? 2 : 1;
  const requiredInterval = Math.max(1, Math.floor(totalEffectiveDays / 2));

  // KUOTA HARIAN MINIMUM (Sesuai Blueprint: Senin min 3, Sel-Kam min 2, Jumat fix 2)
  const fridayQuota = 2; 
  const baseTueThuQuota = 2; 
  const mondayQuota = 3; 

  const dailyQuotas = validDays.map((d) => {
    if (d.dayOfWeek === 1) return mondayQuota;
    if (d.dayOfWeek === 5) return fridayQuota;
    return baseTueThuQuota;
  });

  const coAssignedPairs = new Set();
  const markPair = (id1, id2) => coAssignedPairs.add([id1, id2].sort().join('___'));
  const arePairedBefore = (id1, id2) => coAssignedPairs.has([id1, id2].sort().join('___'));

  const staffState = {};
  const randomizedStaffList = [...cleanStaffList].sort(() => Math.random() - 0.5);

  randomizedStaffList.forEach((s) => {
    staffState[s.id] = {
      id: s.id,
      name: s.name,
      count: 0,
      assignedDays: [],
      assignedDaysOfWeek: [] // Kunci larangan piket di hari yang sama
    };
  });

  // ---------------------------------------------------------------------------
  // 3. PASS 1: ALOKASI UTAMA (MEMENUHI KUOTA MINIMAL)
  // ---------------------------------------------------------------------------
  validDays.forEach((day, dayIdx) => {
    const quota = dailyQuotas[dayIdx];

    for (let q = 0; q < quota; q++) {
      let candidates = randomizedStaffList
        .map((s) => staffState[s.id])
        .filter((st) => {
          if (st.count >= targetPerStaff) return false;
          if (st.assignedDays.includes(dayIdx)) return false;
          // Kunci Mati: Hari dilarang sama dengan piket sebelumnya
          if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;

          if (st.assignedDays.length > 0) {
            const firstAssignedIdx = st.assignedDays[0];
            if (Math.abs(dayIdx - firstAssignedIdx) < requiredInterval) return false;
          }

          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;

          return true;
        });

      // Relax pasangan
      if (candidates.length === 0) {
        candidates = randomizedStaffList
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (st.assignedDays.length > 0) {
              const firstAssignedIdx = st.assignedDays[0];
              if (Math.abs(dayIdx - firstAssignedIdx) < requiredInterval) return false;
            }
            return true;
          });
      }

      // Relax interval
      if (candidates.length === 0) {
        candidates = randomizedStaffList
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            return true;
          });
      }

      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        const distA = a.assignedDays.length > 0 ? Math.abs(dayIdx - a.assignedDays[0]) : 999;
        const distB = b.assignedDays.length > 0 ? Math.abs(dayIdx - b.assignedDays[0]) : 999;
        if (distA !== distB) return distB - distA;
        return Math.random() - 0.5;
      });

      const chosen = candidates[0];
      day.assigned.forEach((existingId) => markPair(chosen.id, existingId));
      
      day.assigned.push(chosen.id);
      chosen.count++;
      chosen.assignedDays.push(dayIdx);
      chosen.assignedDaysOfWeek.push(day.dayOfWeek);
    }
  });

  // ---------------------------------------------------------------------------
  // 4. PASS 2: PEMENUHAN BEBAN SDM (PRIORITAS TUTUP DEFISIT LALU KE SENIN)
  // ---------------------------------------------------------------------------
  randomizedStaffList.forEach((s) => {
    const st = staffState[s.id];

    while (st.count < targetPerStaff) {
      let eligibleDays = validDays
        .map((d, idx) => ({ day: d, idx }))
        .filter(({ day, idx }) => {
          if (st.assignedDays.includes(idx)) return false;
          if (day.dayOfWeek === 5 && day.assigned.length >= 2) return false; // Jumat max 2
          if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false; // Larangan hari sama

          if (st.assignedDays.length > 0) {
            const firstIdx = st.assignedDays[0];
            if (Math.abs(idx - firstIdx) < requiredInterval) return false;
          }

          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;

          return true;
        });

      if (eligibleDays.length === 0) {
        eligibleDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false;
            if (day.dayOfWeek === 5 && day.assigned.length >= 2) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            return true;
          });
      }

      if (eligibleDays.length > 0) {
        // Sorting Cerdas: Dahulukan hari kosong, lalu lempar sisanya ke Senin
        eligibleDays.sort((a, b) => {
          const minA = a.day.dayOfWeek === 1 ? 3 : 2;
          const minB = b.day.dayOfWeek === 1 ? 3 : 2;
          const deficitA = Math.max(0, minA - a.day.assigned.length);
          const deficitB = Math.max(0, minB - b.day.assigned.length);
          
          if (deficitA !== deficitB) return deficitB - deficitA; 

          // Jika semua minimal terpenuhi, prioritas mutlak ke Senin
          if (a.day.dayOfWeek === 1 && b.day.dayOfWeek !== 1) return -1;
          if (b.day.dayOfWeek === 1 && a.day.dayOfWeek !== 1) return 1;

          if (a.day.assigned.length !== b.day.assigned.length) {
            return a.day.assigned.length - b.day.assigned.length;
          }

          const distA = st.assignedDays.length > 0 ? Math.abs(a.idx - st.assignedDays[0]) : 0;
          const distB = st.assignedDays.length > 0 ? Math.abs(b.idx - st.assignedDays[0]) : 0;
          if (distA !== distB) return distB - distA;

          return Math.random() - 0.5;
        });

        const targetDay = eligibleDays[0];
        targetDay.day.assigned.forEach((existingId) => markPair(st.id, existingId));

        targetDay.day.assigned.push(st.id);
        st.count++;
        st.assignedDays.push(targetDay.idx);
        st.assignedDaysOfWeek.push(targetDay.day.dayOfWeek);
      } else {
        break;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 5. PASS 3: REBALANCING (TUTUP HARI KOSONG & SENIN TERBANYAK)
  // ---------------------------------------------------------------------------
  // Step 3A: Tambal hari yang kurang (Defisit) dengan mengambil dari hari surplus
  let hasDeficit = true;
  let loops = 0;
  
  while (hasDeficit && loops < 50) {
    hasDeficit = false;
    loops++;
    
    const deficitDay = validDays.find(d => {
      const min = d.dayOfWeek === 1 ? 3 : 2;
      return d.assigned.length < min;
    });

    if (deficitDay) {
      hasDeficit = true;
      const donors = [...validDays].filter(d => {
        if (d.dateStr === deficitDay.dateStr) return false;
        if (d.dayOfWeek === 1) return d.assigned.length > 3; // Ambil dari Senin yg kelebihan
        if (d.dayOfWeek === 5) return false; // Jumat jangan diganggu
        return d.assigned.length > 2; // Sel-Kam yg > 2
      }).sort((a, b) => b.assigned.length - a.assigned.length);

      let moved = false;
      for (const donor of donors) {
        for (let i = 0; i < donor.assigned.length; i++) {
          const staffId = donor.assigned[i];
          const st = staffState[staffId];
          
          if (!deficitDay.assigned.includes(staffId)) {
            const otherDaysOfWeek = st.assignedDaysOfWeek.filter(dow => dow !== donor.dayOfWeek);
            if (!otherDaysOfWeek.includes(deficitDay.dayOfWeek)) {
              // Pindahkan petugas
              donor.assigned.splice(i, 1);
              deficitDay.assigned.push(staffId);
              
              st.assignedDays = st.assignedDays.filter(idx => idx !== validDays.indexOf(donor));
              st.assignedDays.push(validDays.indexOf(deficitDay));
              st.assignedDaysOfWeek = otherDaysOfWeek;
              st.assignedDaysOfWeek.push(deficitDay.dayOfWeek);
              moved = true;
              break;
            }
          }
        }
        if (moved) break;
      }
      if (!moved) break;
    }
  }

  // Step 3B: Lempar semua sisa kelebihan di Sel-Kam kembali ke Senin
  validDays.forEach((day) => {
    if (day.dayOfWeek >= 2 && day.dayOfWeek <= 4) {
      while (day.assigned.length > 2) {
        const mondays = validDays.filter(d => d.dayOfWeek === 1)
          .sort((a, b) => {
             if (a.weekIndex === day.weekIndex && b.weekIndex !== day.weekIndex) return -1;
             if (b.weekIndex === day.weekIndex && a.weekIndex !== day.weekIndex) return 1;
             return a.assigned.length - b.assigned.length;
          });

        let moved = false;
        for (const mondayObj of mondays) {
          for (let i = 0; i < day.assigned.length; i++) {
            const staffId = day.assigned[i];
            const st = staffState[staffId];
            
            if (!mondayObj.assigned.includes(staffId)) {
              const otherDaysOfWeek = st.assignedDaysOfWeek.filter(dow => dow !== day.dayOfWeek);
              if (!otherDaysOfWeek.includes(1)) {
                day.assigned.splice(i, 1);
                mondayObj.assigned.push(staffId);
                
                st.assignedDays = st.assignedDays.filter(idx => idx !== validDays.indexOf(day));
                st.assignedDays.push(validDays.indexOf(mondayObj));
                st.assignedDaysOfWeek = otherDaysOfWeek;
                st.assignedDaysOfWeek.push(1);
                moved = true;
                break;
              }
            }
          }
          if (moved) break;
        }
        if (!moved) break; 
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 6. OUTPUT STRUKTUR FIREBASE
  // ---------------------------------------------------------------------------
  const resultObj = {};
  workDays.forEach((d) => {
    resultObj[d.dateStr] = {
      formattedLabel: d.formattedLabel,
      dayName: d.dayName,
      dayNumber: d.dayNumber,
      weekIndex: d.weekIndex,
      assigned: d.assigned || [],
      isHoliday: d.isHoliday,
      holidayTitle: d.holidayTitle,
      dayOfWeek: d.dayOfWeek
    };
  });

  return resultObj;
}
