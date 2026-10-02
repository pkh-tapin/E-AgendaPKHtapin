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
 * 6. Garansi Kuota Harian & Anti Senin-Senin:
 *    - SENIN        : TERBANYAK / PRIORITAS (Dilarang keras 1 SDM dapat 2x Senin).
 *    - SELASA-KAMIS : Kuota standar (piketHarianQuota).
 *    - JUMAT        : KUNCI MATI maksimal 2 orang.
 *    - GARANSI AKHIR: Setiap SDM WAJIB mendapatkan TEPAT 2 kali piket (tidak kurang/lebih).
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

    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sabtu & Minggu
      const dateStr = `\({targetYear}-\){String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const formattedLabel = `\({d}\){namaBulan[targetMonth - 1]} ${targetYear}`;
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
  // SANITASI & FILTER SDM MURNI DARI DATABASE (MEMBUANG NAMA DUMMY SISA)
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

    if (isSampleName && (isLegacyId || hasNoDetails)) {
      return false;
    }
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
  const totalShiftsNeeded = totalSdm * targetPerStaff;

  // FORMULA INTERVAL KUNCI MATI: TOTAL HARI KERJA / 2 (MINIMAL 10-14 HARI)
  const requiredInterval = Math.max(1, Math.floor(totalEffectiveDays / 2));

  // KALKULASI KUOTA HARIAN DINAMIS PRESISI
  const fridayQuota = 2; // Jumat Kunci Mati Maksimal 2
  const countFridays = validDays.filter(d => d.dayOfWeek === 5).length;
  const countMondays = validDays.filter(d => d.dayOfWeek === 1).length;
  const countTueThu = validDays.filter(d => d.dayOfWeek >= 2 && d.dayOfWeek <= 4).length;

  const totalFridaySlots = countFridays * fridayQuota;
  const remainingShiftsNeeded = Math.max(0, totalShiftsNeeded - totalFridaySlots);

  // Hitung Kuota Dasar Selasa-Kamis & Kuota Tambahan Senin
  let baseTueThuQuota = Math.max(2, Math.floor(remainingShiftsNeeded / (countMondays * 1.5 + countTueThu)));
  let mondayQuota = Math.max(baseTueThuQuota + 1, Number(config.piketSeninQuota) || 3);

  const dailyQuotas = validDays.map((d) => {
    if (d.dayOfWeek === 1) return mondayQuota;
    if (d.dayOfWeek === 5) return fridayQuota;
    return baseTueThuQuota;
  });

  // TRACKER PASANGAN PETUGAS (VARIASI PASANGAN AGAR ADIL)
  const coAssignedPairs = new Set();

  const markPair = (id1, id2) => {
    if (!id1 || !id2 || id1 === id2) return;
    const key = [id1, id2].sort().join('___');
    coAssignedPairs.add(key);
  };

  const arePairedBefore = (id1, id2) => {
    if (!id1 || !id2 || id1 === id2) return false;
    const key = [id1, id2].sort().join('___');
    return coAssignedPairs.has(key);
  };

  const staffState = {};
  const randomizedStaffList = [...cleanStaffList].sort(() => Math.random() - 0.5);

  randomizedStaffList.forEach((s) => {
    staffState[s.id] = {
      id: s.id,
      name: s.name,
      count: 0,
      assignedDays: [],
      assignedDaysOfWeek: [],
      mondayAssigned: false
    };
  });

  // ---------------------------------------------------------------------------
  // 3. PASS 1: ALOKASI UTAMA DENGAN FILTER VARIASI PASANGAN & INTERVAL N/2
  // ---------------------------------------------------------------------------
  validDays.forEach((day, dayIdx) => {
    const quota = dailyQuotas[dayIdx];

    for (let q = 0; q < quota; q++) {
      // Attempt A: Memenuhi semua syarat ketat (Interval N/2, Anti-Duplikasi Pasangan, No Same DayOfWeek)
      let candidates = randomizedStaffList
        .map((s) => staffState[s.id])
        .filter((st) => {
          if (st.count >= targetPerStaff) return false;
          if (st.assignedDays.includes(dayIdx)) return false;
          if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false; 

          // Cek Jarak Interval Piket 1 & Piket 2 = Total Hari / 2
          if (st.assignedDays.length > 0) {
            const firstAssignedIdx = st.assignedDays[0];
            if (Math.abs(dayIdx - firstAssignedIdx) < requiredInterval) return false;
          }

          if (day.dayOfWeek === 1 && st.mondayAssigned) return false;

          // LOGIKA VARIASI PASANGAN: Cegah SDM berkumpul dengan teman piket ke-1
          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;

          return true;
        });

      // Attempt B: Kendurkan batas variasi pasangan
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

            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            return true;
          });
      }

      // Attempt C: Kendurkan jarak interval jika keterbatasan slot
      if (candidates.length === 0) {
        candidates = randomizedStaffList
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
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

      day.assigned.forEach((existingId) => {
        markPair(chosen.id, existingId);
      });

      day.assigned.push(chosen.id);
      chosen.count++;
      chosen.assignedDays.push(dayIdx);
      chosen.assignedDaysOfWeek.push(day.dayOfWeek);
      if (day.dayOfWeek === 1) chosen.mondayAssigned = true;
    }
  });

  // ---------------------------------------------------------------------------
  // 4. PASS 2: PEMENUHAN BEBAN SDM (PENCEGAHAN KEKURANGAN SHIFT - GARANSI RATA 2)
  // ---------------------------------------------------------------------------
  randomizedStaffList.forEach((s) => {
    const st = staffState[s.id];

    while (st.count < targetPerStaff) {
      // Prioritas 1: Cari hari yang memenuhi jarak interval & anti-pasangan berulang
      let eligibleDays = validDays
        .map((d, idx) => ({ day: d, idx }))
        .filter(({ day, idx }) => {
          if (st.assignedDays.includes(idx)) return false;
          if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
          if (day.dayOfWeek === 5 && day.assigned.length >= fridayQuota) return false;
          if (day.dayOfWeek === 1 && st.mondayAssigned) return false;

          if (st.assignedDays.length > 0) {
            const firstIdx = st.assignedDays[0];
            if (Math.abs(idx - firstIdx) < requiredInterval) return false;
          }

          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;

          return true;
        });

      // Prioritas 2: Kendurkan jarak interval
      if (eligibleDays.length === 0) {
        eligibleDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (day.dayOfWeek === 5 && day.assigned.length >= fridayQuota) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            return true;
          });
      }

      // Prioritas 3: Emergency Bypass - Selama bukan di hari yang sama
      if (eligibleDays.length === 0) {
        eligibleDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false;
            if (day.dayOfWeek === 5 && day.assigned.length >= fridayQuota) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            return true;
          });
      }

      if (eligibleDays.length > 0) {
        eligibleDays.sort((a, b) => {
          // Utamakan meratakan jumlah petugas di hari tersebut
          if (a.day.assigned.length !== b.day.assigned.length) {
            return a.day.assigned.length - b.day.assigned.length;
          }
          
          // Setelah itu maksimalkan jarak piket
          const distA = st.assignedDays.length > 0 ? Math.abs(a.idx - st.assignedDays[0]) : 0;
          const distB = st.assignedDays.length > 0 ? Math.abs(b.idx - st.assignedDays[0]) : 0;
          if (distA !== distB) return distB - distA;
          
          return Math.random() - 0.5;
        });

        const targetDay = eligibleDays[0];

        targetDay.day.assigned.forEach((existingId) => {
          markPair(st.id, existingId);
        });

        targetDay.day.assigned.push(st.id);
        st.count++;
        st.assignedDays.push(targetDay.idx);
        st.assignedDaysOfWeek.push(targetDay.day.dayOfWeek);
        if (targetDay.day.dayOfWeek === 1) st.mondayAssigned = true;
      } else {
        break; // Penanganan cadangan penuh
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 5. PASS 3: GLOBAL REBALANCING (PENYEIMBANGAN BEBAN & KETERTIBAN KUOTA)
  // ---------------------------------------------------------------------------
  validDays.forEach((day) => {
    // Toleransi penumpukan: Senin maksimal (mondayQuota + 1), Selasa-Kamis maksimal (baseTueThuQuota + 1)
    const maxAllowed = day.dayOfWeek === 1 ? (mondayQuota + 1) : (day.dayOfWeek === 5 ? fridayQuota : (baseTueThuQuota + 1));

    while (day.assigned.length > maxAllowed) {
      const candidateDays = validDays.filter(d => 
        d.dateStr !== day.dateStr && 
        d.dayOfWeek !== 5 && // Dilarang keras membuang beban berlebih ke hari Jumat
        ((d.dayOfWeek === 1 && d.assigned.length < mondayQuota) || (d.dayOfWeek >= 2 && d.dayOfWeek <= 4 && d.assigned.length < baseTueThuQuota))
      ).sort((a, b) => {
        if (a.dayOfWeek === 1 && b.dayOfWeek !== 1) return -1;
        if (b.dayOfWeek === 1 && a.dayOfWeek !== 1) return 1;
        return a.assigned.length - b.assigned.length;
      });

      if (candidateDays.length === 0) break; 

      let moved = false;
      for (const targetD of candidateDays) {
        const staffIdx = day.assigned.findIndex(id => {
          const st = staffState[id];
          return !targetD.assigned.includes(id) && !st.assignedDaysOfWeek.includes(targetD.dayOfWeek);
        });

        if (staffIdx !== -1) {
          const movedId = day.assigned.splice(staffIdx, 1)[0];
          targetD.assigned.push(movedId);
          
          const st = staffState[movedId];
          st.assignedDaysOfWeek = st.assignedDaysOfWeek.filter(dow => dow !== day.dayOfWeek);
          st.assignedDaysOfWeek.push(targetD.dayOfWeek);
          moved = true;
          break;
        }
      }
      if (!moved) break; 
    }
  });

  // ---------------------------------------------------------------------------
  // 6. PASS 4: PENGECEKAN KERAS ANTI SENIN-SENIN & SWAP OPTIMIZER
  // ---------------------------------------------------------------------------
  Object.values(staffState).forEach((st) => {
    const mondaySlots = st.assignedDays.filter(dayIdx => validDays[dayIdx].dayOfWeek === 1);
    
    // Jika ada SDM yang mendapatkan 2 kali piket di hari Senin
    if (mondaySlots.length > 1) {
      const secondMondayIdx = mondaySlots[1];
      const secondMondayDay = validDays[secondMondayIdx];
      
      // Cari hari lain (Selasa-Kamis) yang memiliki SDM lain tanpa tugas Senin
      for (let i = 0; i < validDays.length; i++) {
        const targetDay = validDays[i];
        if (targetDay.dayOfWeek >= 2 && targetDay.dayOfWeek <= 4 && !st.assignedDays.includes(i)) {
          
          // Cari kandidat swap di targetDay yang belum pernah dapat piket Senin
          const swapCandidateId = targetDay.assigned.find(candidateId => {
            const candSt = staffState[candidateId];
            return candSt && !candSt.mondayAssigned && !secondMondayDay.assigned.includes(candidateId);
          });

          if (swapCandidateId) {
            // Lakukan tukar slot (Swap)
            const candSt = staffState[swapCandidateId];

            secondMondayDay.assigned = secondMondayDay.assigned.filter(id => id !== st.id);
            secondMondayDay.assigned.push(swapCandidateId);

            targetDay.assigned = targetDay.assigned.filter(id => id !== swapCandidateId);
            targetDay.assigned.push(st.id);

            // Update state SDM 1
            st.assignedDays = st.assignedDays.filter(idx => idx !== secondMondayIdx);
            st.assignedDays.push(i);
            st.assignedDaysOfWeek = st.assignedDays.map(idx => validDays[idx].dayOfWeek);

            // Update state SDM 2
            candSt.assignedDays = candSt.assignedDays.filter(idx => idx !== i);
            candSt.assignedDays.push(secondMondayIdx);
            candSt.assignedDaysOfWeek = candSt.assignedDays.map(idx => validDays[idx].dayOfWeek);
            candSt.mondayAssigned = true;

            break;
          }
        }
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 7. OUTPUT STRUKTUR FIREBASE RESMI
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
