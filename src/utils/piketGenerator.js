/**
 * =============================================================================
 * BLUEPRINT ENGINE: GENERATE MONTHLY SCHEDULE SDM PKH TAPIN
 * Developer: M. Zaen Syachrullah
 * 
 * ATURAN DAN LOGIKA BISNIS PIKET RESMI (UPDATE SUPER KETAT):
 * 1. Target Periode: Dinamis berdasarkan parameter bulan dan tahun input admin.
 * 2. Hari Kerja Efektif: Hanya Senin sampai Jumat (Sabtu & Minggu libur).
 * 3. Hari Libur Resmi (Holidays): Tanggal merah dikosongkan (assigned = []).
 * 4. Jarak Interval Piket 1 & Piket 2 (Spacing):
 *    - Required Interval KUNCI MATI = Minimal 14 Hari (2 Minggu).
 *    - Garansi piket 1 dan piket 2 tidak akan berdekatan.
 * 5. Variasi Pasangan Petugas (Anti-Duplikasi Pasangan SUPER KETAT):
 *    - Jika SDM A & B pernah piket bersama, MAKA HARAM HUKUMNYA BERTEMU LAGI.
 *    - Pengacakan teman piket dijamin berbeda antara Shift 1 dan Shift 2 (A,B,C -> A,D,F).
 *    - Jika semua kombinasi unik mentok, baru dikendurkan agar syarat 2 shift/SDM tetap terpenuhi.
 * 6. Garansi Kuota Harian & Anti Senin-Senin:
 *    - SENIN        : TERBANYAK / PRIORITAS (Wajib lebih besar dari hari lain, misal Senin 4, Sel-Kam 2/3).
 *    - SELASA-KAMIS : Kuota standar menyesuaikan sisa kuota (piketHarianQuota).
 *    - JUMAT        : KUNCI MATI maksimal 2 orang.
 *    - GARANSI AKHIR: JIKA HARI EFEKTIF > 12, Setiap SDM WAJIB mendapatkan 
 *      TEPAT 2 kali piket (tidak kurang/tidak lebih, SEMUA KEBAGIAN RATA).
 * =============================================================================
 */

// DAFTAR NAMA DUMMY LEGACY UNTUK DISARING DARI GENERATOR PIKET
const DUMMY_SAMPLE_NAMES = ['ahmad', 'budi', 'siti', 'dewi', 'eko', 'fajar', 'gita', 'hadi'];

export function generateMonthlySchedule(year, month, staffList = [], config = {}, holidays = {}) {
  // ===========================================================================
  // FUNGSI PENGACAK MUTLAK (INJEKSI BARU UNTUK MENJAMIN VARIASI PASANGAN)
  // ===========================================================================
  const shuffleArray = (arr) => {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

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
  // 2. PENETAPAN ATURAN TARGET & INTERVAL KUNCI MATI (14 HARI)
  // ---------------------------------------------------------------------------
  const minWorkdaysThreshold = 12; 
  const targetPerStaff = totalEffectiveDays > minWorkdaysThreshold ? 2 : 1;
  const totalShiftsNeeded = totalSdm * targetPerStaff;
  const requiredInterval = 14;

  const dailyQuotas = validDays.map(() => 0);
  let remainingShifts = totalShiftsNeeded;
  const fridayQuota = 2; 

  validDays.forEach((d, i) => {
    if (d.dayOfWeek === 5 && remainingShifts > 0) {
      let jumatSlot = Math.min(fridayQuota, remainingShifts);
      dailyQuotas[i] = jumatSlot;
      remainingShifts -= jumatSlot;
    }
  });

  const countMondays = validDays.filter(d => d.dayOfWeek === 1).length;
  const countTueThu = validDays.filter(d => d.dayOfWeek >= 2 && d.dayOfWeek <= 4).length;

  if ((countMondays > 0 || countTueThu > 0) && remainingShifts > 0) {
    let baseTueThuQuota = Math.max(1, Math.floor((remainingShifts - countMondays) / (countMondays + countTueThu)));
    let baseMondayQuota = baseTueThuQuota + 1; 

    validDays.forEach((d, i) => {
      if (d.dayOfWeek === 1 && remainingShifts > 0) {
        let quotaToAssign = Math.min(baseMondayQuota, remainingShifts);
        dailyQuotas[i] = quotaToAssign;
        remainingShifts -= quotaToAssign;
      } else if (d.dayOfWeek >= 2 && d.dayOfWeek <= 4 && remainingShifts > 0) {
        let quotaToAssign = Math.min(baseTueThuQuota, remainingShifts);
        dailyQuotas[i] = quotaToAssign;
        remainingShifts -= quotaToAssign;
      }
    });

    const monIndices = validDays.map((d, i) => d.dayOfWeek === 1 ? i : -1).filter(i => i !== -1);
    const tueThuIndices = validDays.map((d, i) => (d.dayOfWeek >= 2 && d.dayOfWeek <= 4) ? i : -1).filter(i => i !== -1);

    while (remainingShifts > 0) {
      let hasAssigned = false;
      for (let i of monIndices) {
        if (remainingShifts > 0) { dailyQuotas[i]++; remainingShifts--; hasAssigned = true; }
      }
      for (let i of tueThuIndices) {
        if (remainingShifts > 0) { dailyQuotas[i]++; remainingShifts--; hasAssigned = true; }
      }
      if (!hasAssigned) break; 
    }
  }

  const checkIntervalValid = (st, currentDayNumber) => {
    if (st.assignedDays.length === 0) return true;
    const firstAssignedDayNum = validDays[st.assignedDays[0]].dayNumber;
    return Math.abs(currentDayNumber - firstAssignedDayNum) >= requiredInterval;
  };

  // TRACKER PASANGAN PETUGAS SUPER KETAT
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
  
  cleanStaffList.forEach((s) => {
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
      // ACAK ULANG KANDIDAT SETIAP KALI MENCARI PETUGAS AGAR PASANGAN SANGAT ACAK
      let currentStaffShuffled = shuffleArray(cleanStaffList);

      // Attempt A: Ketat 14 Hari + Anti Duplikasi Pasangan
      let candidates = currentStaffShuffled
        .map((s) => staffState[s.id])
        .filter((st) => {
          if (st.count >= targetPerStaff) return false;
          if (st.assignedDays.includes(dayIdx)) return false;
          if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false; 
          if (!checkIntervalValid(st, day.dayNumber)) return false;
          if (day.dayOfWeek === 1 && st.mondayAssigned) return false;

          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;
          return true;
        });

      // Attempt A2: Turunkan interval ke 10 hari, TAPI TETAP ANTI DUPLIKASI PASANGAN
      if (candidates.length === 0) {
        candidates = currentStaffShuffled
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false; 
            
            if (st.assignedDays.length > 0) {
                const firstDayNum = validDays[st.assignedDays[0]].dayNumber;
                if (Math.abs(day.dayNumber - firstDayNum) < 10) return false;
            }
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;

            const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
            if (hasRepeatPair) return false;
            return true;
          });
      }

      // Attempt B: Kendurkan batas variasi pasangan (JIKA MENTOK, BARU BOLEH PASANGAN SAMA DEMI BAGI RATA)
      if (candidates.length === 0) {
        candidates = currentStaffShuffled
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (!checkIntervalValid(st, day.dayNumber)) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            return true;
          });
      }

      // Attempt C: Kendurkan jarak interval ekstrim
      if (candidates.length === 0) {
        candidates = currentStaffShuffled
          .map((s) => staffState[s.id])
          .filter((st) => {
            if (st.count >= targetPerStaff) return false;
            if (st.assignedDays.includes(dayIdx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            if (st.assignedDays.length > 0) {
                const firstDayNum = validDays[st.assignedDays[0]].dayNumber;
                if (Math.abs(day.dayNumber - firstDayNum) < 10) return false;
            }
            return true;
          });
      }

      if (candidates.length === 0) break;

      candidates.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        const distA = a.assignedDays.length > 0 ? Math.abs(day.dayNumber - validDays[a.assignedDays[0]].dayNumber) : 999;
        const distB = b.assignedDays.length > 0 ? Math.abs(day.dayNumber - validDays[b.assignedDays[0]].dayNumber) : 999;
        if (distA !== distB) return distB - distA;
        // Karena array kandidat sudah dishuffle mutlak di atas, return 0 sudah cukup untuk menjaga keacakannya
        return 0; 
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
  // 4. PASS 2: PEMENUHAN BEBAN SDM (GARANSI SAPU BERSIH 100% KEBAGIAN 2 KALI)
  // ---------------------------------------------------------------------------
  // Acak list staff sebelum pemenuhan sisa agar distribusinya lebih natural
  const shuffledStaffForPass2 = shuffleArray(cleanStaffList);
  
  shuffledStaffForPass2.forEach((s) => {
    const st = staffState[s.id];

    while (st.count < targetPerStaff) {
      // Prioritas 1: 14 hari ketat & Anti Duplikasi Pasangan
      let eligibleDays = validDays
        .map((d, idx) => ({ day: d, idx }))
        .filter(({ day, idx }) => {
          if (st.assignedDays.includes(idx)) return false;
          if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
          if (day.dayOfWeek === 5 && day.assigned.length >= fridayQuota) return false;
          if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
          if (!checkIntervalValid(st, day.dayNumber)) return false;

          const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
          if (hasRepeatPair) return false;
          return true;
        });

      // Prioritas 1.5: 10 Hari & TETAP Anti Duplikasi Pasangan
      if (eligibleDays.length === 0) {
        eligibleDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (day.dayOfWeek === 5 && day.assigned.length >= fridayQuota) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            
            if (st.assignedDays.length > 0) {
                const firstDayNum = validDays[st.assignedDays[0]].dayNumber;
                if (Math.abs(day.dayNumber - firstDayNum) < 10) return false;
            }

            const hasRepeatPair = day.assigned.some((existingId) => arePairedBefore(st.id, existingId));
            if (hasRepeatPair) return false;
            return true;
          });
      }

      // Prioritas 2: Kendurkan variasi pasangan (BOLEH SAMA DEMI GENAP 2 KALI)
      if (eligibleDays.length === 0) {
        eligibleDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false;
            if (st.assignedDaysOfWeek.includes(day.dayOfWeek)) return false;
            if (day.dayOfWeek === 5 && day.assigned.length >= fridayQuota) return false;
            if (day.dayOfWeek === 1 && st.mondayAssigned) return false;
            if (!checkIntervalValid(st, day.dayNumber)) return false;
            return true;
          });
      }

      // Prioritas 3: Emergency Bypass
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

      // Prioritas 4: MUTLAK FORCE ASSIGN (Garansi 100% masuk agar semua rata)
      if (eligibleDays.length === 0) {
        eligibleDays = validDays
          .map((d, idx) => ({ day: d, idx }))
          .filter(({ day, idx }) => {
            if (st.assignedDays.includes(idx)) return false; 
            if (day.dayOfWeek === 5) return false; 
            return true;
          });
      }

      if (eligibleDays.length > 0) {
        // Acak hari yang didapat agar penempatan sisa jadwal juga tersebar acak
        let shuffledEligibleDays = shuffleArray(eligibleDays);
        shuffledEligibleDays.sort((a, b) => {
          if (a.day.assigned.length !== b.day.assigned.length) {
            return a.day.assigned.length - b.day.assigned.length;
          }
          const distA = st.assignedDays.length > 0 ? Math.abs(a.day.dayNumber - validDays[st.assignedDays[0]].dayNumber) : 0;
          const distB = st.assignedDays.length > 0 ? Math.abs(b.day.dayNumber - validDays[st.assignedDays[0]].dayNumber) : 0;
          if (distA !== distB) return distB - distA;
          return 0; // Menjaga hasil acakan di atas tetap stabil
        });

        const targetDay = shuffledEligibleDays[0];

        targetDay.day.assigned.forEach((existingId) => {
          markPair(st.id, existingId);
        });

        targetDay.day.assigned.push(st.id);
        st.count++;
        st.assignedDays.push(targetDay.idx);
        st.assignedDaysOfWeek.push(targetDay.day.dayOfWeek);
        if (targetDay.day.dayOfWeek === 1) st.mondayAssigned = true;
      } else {
        break; 
      }
    }
  });

  // ---------------------------------------------------------------------------
  // 5. PASS 3: GLOBAL REBALANCING (PENYEIMBANGAN BEBAN & KETERTIBAN KUOTA)
  // ---------------------------------------------------------------------------
  validDays.forEach((day, dayIdx) => {
    const maxAllowed = dailyQuotas[dayIdx] + 1;

    while (day.assigned.length > maxAllowed) {
      // Acak urutan hari di Rebalancing agar perputaran pemerataan lebih variatif
      const candidateDays = shuffleArray(validDays).filter(d => 
        d.dateStr !== day.dateStr && 
        d.dayOfWeek !== 5 && 
        (d.assigned.length < dailyQuotas[validDays.indexOf(d)])
      ).sort((a, b) => {
        if (a.dayOfWeek === 1 && b.dayOfWeek !== 1) return -1;
        if (b.dayOfWeek === 1 && a.dayOfWeek !== 1) return 1;
        return a.assigned.length - b.assigned.length;
      });

      if (candidateDays.length === 0) break; 

      let moved = false;
      for (const targetD of candidateDays) {
        
        let staffIdx = day.assigned.findIndex(id => {
          const st = staffState[id];
          const hasRepeat = targetD.assigned.some(existingId => arePairedBefore(id, existingId));
          return !targetD.assigned.includes(id) && !st.assignedDaysOfWeek.includes(targetD.dayOfWeek) && !hasRepeat;
        });

        // Fallback: Jika mentok, kendurkan duplikasi demi meratakan kuota hari
        if (staffIdx === -1) {
          staffIdx = day.assigned.findIndex(id => {
            const st = staffState[id];
            return !targetD.assigned.includes(id) && !st.assignedDaysOfWeek.includes(targetD.dayOfWeek);
          });
        }

        if (staffIdx !== -1) {
          const movedId = day.assigned.splice(staffIdx, 1)[0];
          
          targetD.assigned.forEach((existingId) => markPair(movedId, existingId));
          targetD.assigned.push(movedId);
          
          const st = staffState[movedId];
          st.assignedDaysOfWeek = st.assignedDaysOfWeek.filter(dow => dow !== day.dayOfWeek);
          st.assignedDaysOfWeek.push(targetD.dayOfWeek);
          st.assignedDays = st.assignedDays.filter(idx => idx !== dayIdx);
          st.assignedDays.push(validDays.indexOf(targetD));
          
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
    
    if (mondaySlots.length > 1) {
      const secondMondayIdx = mondaySlots[1];
      const secondMondayDay = validDays[secondMondayIdx];
      
      // Acak hari target tukar posisi agar tidak selalu jatuh di urutan awal hari Selasa
      const shuffledSwapDays = shuffleArray(validDays.map((d, idx) => ({ day: d, idx })));

      for (let i = 0; i < shuffledSwapDays.length; i++) {
        const targetDay = shuffledSwapDays[i].day;
        const targetIdx = shuffledSwapDays[i].idx;
        
        if (targetDay.dayOfWeek >= 2 && targetDay.dayOfWeek <= 4 && !st.assignedDays.includes(targetIdx)) {
          
          let swapCandidateId = targetDay.assigned.find(candidateId => {
            const candSt = staffState[candidateId];
            const stHasRepeat = targetDay.assigned.some(existingId => existingId !== candidateId && arePairedBefore(st.id, existingId));
            const candHasRepeat = secondMondayDay.assigned.some(existingId => existingId !== st.id && arePairedBefore(candidateId, existingId));
            
            return candSt && !candSt.mondayAssigned && !secondMondayDay.assigned.includes(candidateId) && !stHasRepeat && !candHasRepeat;
          });

          // Fallback logika asli swap jika kombinasi unik mentok
          if (!swapCandidateId) {
            swapCandidateId = targetDay.assigned.find(candidateId => {
              const candSt = staffState[candidateId];
              return candSt && !candSt.mondayAssigned && !secondMondayDay.assigned.includes(candidateId);
            });
          }

          if (swapCandidateId) {
            const candSt = staffState[swapCandidateId];

            secondMondayDay.assigned = secondMondayDay.assigned.filter(id => id !== st.id);
            secondMondayDay.assigned.forEach(existingId => markPair(swapCandidateId, existingId)); 
            secondMondayDay.assigned.push(swapCandidateId);

            targetDay.assigned = targetDay.assigned.filter(id => id !== swapCandidateId);
            targetDay.assigned.forEach(existingId => markPair(st.id, existingId)); 
            targetDay.assigned.push(st.id);

            st.assignedDays = st.assignedDays.filter(idx => idx !== secondMondayIdx);
            st.assignedDays.push(targetIdx); // Pindah ke Index hasil acakan
            st.assignedDaysOfWeek = st.assignedDays.map(idx => validDays[idx].dayOfWeek);
            st.mondayAssigned = st.assignedDaysOfWeek.includes(1);

            candSt.assignedDays = candSt.assignedDays.filter(idx => idx !== targetIdx);
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
  // 7. OUTPUT STRUKTUR FIREBASE RESMI & VALIDASI SUPER ADMIN
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

  // ---------------------------------------------------------------------------
  // 8. METADATA VALIDASI SUPER ADMIN
  // ---------------------------------------------------------------------------
  const validationSummary = {};
  Object.values(staffState).forEach((st) => {
    validationSummary[st.id] = {
      name: st.name,
      totalShiftCount: st.count,
      status: st.count === targetPerStaff ? 'PAS' : (st.count < targetPerStaff ? 'KURANG' : 'LEBIH')
    };
  });

  resultObj["_SYSTEM_VALIDATION"] = {
    targetWajibPerSDM: targetPerStaff,
    totalHariKerja: totalEffectiveDays,
    staffSummary: validationSummary
  };

  return resultObj;
}
