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
 *    - SENIN        : STRICTLY TERBANYAK (Contoh: jika Selasa-Kamis = 3, Senin = 4 atau 5).
 *    - SELASA-KAMIS : Kuota standar (piketHarianQuota), harus < jumlah petugas Senin.
 *    - JUMAT        : KUNCI MATI maksimal 2 orang.
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

    // Jika merupakan nama sample dummy dengan ID legacy / tanpa kelengkapan biodata
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

  // FORMULA INTERVAL KUNCI MATI: TOTAL HARI KERJA / 2
  const requiredInterval = Math.max(1, Math.floor(totalEffectiveDays / 2));

  // KUOTA HARIAN
  const fridayQuota = 2; // Jumat maksimal 2
  const baseTueThuQuota = Math.max(2, Number(config.piketHarianQuota) || 3);
  const mondayQuota = Math.max(baseTueThuQuota + 1, Number(config.piketSeninQuota) || (baseTueThuQuota + 1), 4);

  const dailyQuotas = validDays.map((d) => {
    if (d.dayOfWeek === 1) return mondayQuota;
    if (d.dayOfWeek === 5) return fridayQuota;
    return baseTueThuQuota;
  });

  // TRACKER PASANGAN PETUGAS (VARIASI PASANGAN AGAR ADIL)
  const coAssignedPairs = new Set();

  const markPair = (id1, id2) => {
    const key = [id1, id2].sort().join('___');
    coAssignedPairs.add(key);
  };

  const arePairedBefore = (id1, id2) => {
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
      mondayAssigned: false
    };
  });

  // ---------------------------------------------------------------------------
  // 3. PASS 1: ALOKASI UTAMA DENGAN FILTER VARIASI PASANGAN & INTERVAL N/2
  // ---------------------------------------------------------------------------
  validDays.forEach((day, dayIdx) => {
    const quota = dailyQuotas[dayIdx];

    for (let q = 0; q < quota; q++) {
      // Attempt A: Memenuhi semua syarat (Target, Spacing N/2, Senin limit, Variasi Pasangan)
      let candidates = randomizedStaffList
        .map((s) => staffState[s.id])
        .filter((st) => {
          if (st.count >= targetPerStaff) return false;
          if (st.assignedDays.includes(dayIdx)) return false;

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

      // Attempt B: Jika tidak ada candidates, kendurkan batas variasi pasangan
      if (candidates.length === 0) {
        candidates = randomizedStaffList
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;

            if (st.assignedDays.length > 0) {
              const firstAssignedIdx = st.assignedDays[0];
              if (Math.abs(dayIdx - firstAssignedIdx) < requiredInterval) return false;
            }

            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            return true;
          });
      }

      // Attempt C: Kendurkan jarak interval jika benar-benar penuh
      if (candidates.length === 0) {
        candidates = randomizedStaffList
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            return true;
          });
      }

      if (candidates.length === 0) break;

      // Urutkan kandidat berdasarkan jumlah piket terendah & jarak terjauh dari piket 1
      candidates.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        const distA = a.assignedDays.length > 0 ? Math.abs(dayIdx - a.assignedDays[0]) : 999;
        const distB = b.assignedDays.length > 0 ? Math.abs(dayIdx - b.assignedDays[0]) : 999;
        if (distA !== distB) return distB - distA;
        return Math.random() - 0.5;
      });

      const chosen = candidates[0];

      // Catat pasangan agar tidak berulang pada piket berikutnya
      day.assigned.forEach((existingId) => {
        markPair(chosen.id, existingId);
      });

      day.assigned.push(chosen.id);
      chosen.count++;
      chosen.assignedDays.push(dayIdx);
      if (day.dayOfWeek === 1) chosen.mondayAssigned = true;
    }
  });

  const getMondayCountForWeek = (weekIdx) => {
    const mondayObj = validDays.find(d => d.weekIndex === weekIdx && d.dayOfWeek === 1);
    return mondayObj ? mondayObj.assigned.length : mondayQuota;
  };

  // ---------------------------------------------------------------------------
  // 4. PASS 2: PEMENUHAN BEBAN SDM BERDASARKAN PROPORSI HARI SENIN
  // ---------------------------------------------------------------------------
  randomizedStaffList.forEach((s) => {
    const st = staffState[s.id];

    while (st.count < targetPerStaff) {
      const eligibleDays = validDays
        .map((d, idx) => ({ day: d, idx }))
        .filter(({ day, idx }) => {
          if (st.assignedDays.includes(idx)) return false;

          // Jumat dikunci maks 2 orang
          if (day.dayOfWeek === 5 && day.assigned.length >= 2) return false;

          // Selasa-Kamis HARUS LEBIH SEDIKIT dari Hari Senin pada minggu terkait
          if (day.dayOfWeek >= 2 && day.dayOfWeek <= 4) {
            const monCount = getMondayCountForWeek(day.weekIndex);
            if (day.assigned.length >= monCount - 1) return false;
          }

          if (st.assignedDays.length > 0) {
            const firstIdx = st.assignedDays[0];
            if (Math.abs(idx - firstIdx) < requiredInterval) return false;
          }

          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;

          return true;
        });

      if (eligibleDays.length === 0) {
        const fallbackDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false;
            if (day.dayOfWeek === 5 && day.assigned.length >= 2) return false;
            return true;
          });

        if (fallbackDays.length > 0) {
          fallbackDays.sort((a, b) => {
            const distA = st.assignedDays.length > 0 ? Math.abs(a.idx - st.assignedDays[0]) : 0;
            const distB = st.assignedDays.length > 0 ? Math.abs(b.idx - st.assignedDays[0]) : 0;
            if (distA !== distB) return distB - distA;
            return a.day.assigned.length - b.day.assigned.length || Math.random() - 0.5;
          });
          const targetDay = fallbackDays[0];

          targetDay.day.assigned.forEach((existingId) => {
            markPair(st.id, existingId);
          });

          targetDay.day.assigned.push(st.id);
          st.count++;
          st.assignedDays.push(targetDay.idx);
          if (targetDay.day.dayOfWeek === 1) st.mondayAssigned = true;
        } else {
          break;
        }
      } else {
        eligibleDays.sort((a, b) => {
          const distA = st.assignedDays.length > 0 ? Math.abs(a.idx - st.assignedDays[0]) : 0;
          const distB = st.assignedDays.length > 0 ? Math.abs(b.idx - st.assignedDays[0]) : 0;
          if (distA !== distB) return distB - distA;
          return a.day.assigned.length - b.day.assigned.length || Math.random() - 0.5;
        });
        const targetDay = eligibleDays[0];

        targetDay.day.assigned.forEach((existingId) => {
          markPair(st.id, existingId);
        });

        targetDay.day.assigned.push(st.id);
        st.count++;
        st.assignedDays.push(targetDay.idx);
        if (targetDay.day.dayOfWeek === 1) st.mondayAssigned = true;
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 5. PASS 3: REBALANCING AKHIR (SENIN STRICTLY HIGHEST)
  // ---------------------------------------------------------------------------
  validDays.forEach((day) => {
    if (day.dayOfWeek >= 2 && day.dayOfWeek <= 4) {
      const monCount = getMondayCountForWeek(day.weekIndex);
      while (day.assigned.length >= monCount && day.assigned.length > 0) {
        const mondayObj = validDays.find(d => d.weekIndex === day.weekIndex && d.dayOfWeek === 1);
        if (mondayObj) {
          const movedStaffId = day.assigned.pop();
          if (!mondayObj.assigned.includes(movedStaffId)) {
            mondayObj.assigned.push(movedStaffId);
          }
        } else {
          break;
        }
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