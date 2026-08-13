import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportPiketToPDF(monthName, year, scheduleData, staffList, config = {}) {
  try {
    // Inisialisasi jsPDF dengan kompresi otomatis (~50KB - 120KB)
    const doc = new jsPDF({
      orientation: 'l',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    const getStaffName = (id) => staffList.find((s) => s.id === id)?.name || id;

    // Header Laporan Resmi (Background Terang dengan Teks Hitam Tegas)
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.rect(0, 0, 297, 28, 'F');

    // Aksen Garis Hitam Tegas
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 27, 297, 1, 'F');

    doc.setTextColor(0, 0, 0); // Semua Huruf Berwarna Hitam
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('JADWAL PIKET ASN PPPK KEMENSOS DI DINAS SOSIAL KABUPATEN TAPIN', 148.5, 12, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`BULAN ${monthName.toUpperCase()} TAHUN ${year}`, 148.5, 21, { align: 'center' });

    // Format Matriks Senin - Jumat
    const sortedDates = Object.entries(scheduleData).sort(([a], [b]) => a.localeCompare(b));
    const weeksMap = {};
    let dynamicWeek = 1;

    sortedDates.forEach(([dateStr, item], idx) => {
      const dateObj = new Date(dateStr);
      const dayOfWeek = item.dayOfWeek || dateObj.getDay();

      if (idx > 0 && dayOfWeek === 1) {
        dynamicWeek++;
      }

      const wIdx = item.weekIndex || dynamicWeek;
      if (!weeksMap[wIdx]) weeksMap[wIdx] = {};
      weeksMap[wIdx][item.dayName] = { dateStr, ...item };
    });

    const weekDaysHeader = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    const tableBody = [];

    Object.entries(weeksMap).forEach(([weekNum, daysInWeek]) => {
      const row = [`MINGGU ${weekNum}`];

      weekDaysHeader.forEach((dayName) => {
        const dayData = daysInWeek[dayName];
        if (!dayData) {
          row.push('-');
        } else if (dayData.isHoliday) {
          row.push(`HARI LIBUR:\n${dayData.holidayTitle || 'Tanggal Merah'}`);
        } else {
          const assignedList = Array.isArray(dayData.assigned) ? dayData.assigned : [];
          const swappedMap = dayData.swappedInfo || {};

          const namesFormatted = assignedList.map((id, index) => {
            const sName = getStaffName(id);
            if (swappedMap[id]) {
              const origName = getStaffName(swappedMap[id].original);
              return `${index + 1}. ${sName} (Tukar dgn ${origName})`;
            }
            return `${index + 1}. ${sName}`;
          }).join('\n');

          row.push(namesFormatted || 'Belum Ada Petugas');
        }
      });

      tableBody.push(row);
    });

    // AutoTable Matriks Kalender dengan Styling Card-Table Glossy
    autoTable(doc, {
      startY: 31,
      head: [['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [226, 232, 240], // Light Slate Header
        textColor: [0, 0, 0],       // Semua Huruf Berwarna Hitam
        fontStyle: 'bold',
        halign: 'center',
        fontSize: 9,
        lineWidth: 0.15,
        lineColor: [148, 163, 184]
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [0, 0, 0],       // Semua Huruf Berwarna Hitam
        valign: 'top',
        cellPadding: { top: 9.5, right: 2.5, bottom: 2.5, left: 2.5 },
        lineWidth: 0.15,
        lineColor: [203, 213, 225]
      },
      columnStyles: {
        0: { 
          cellWidth: 24, 
          fontStyle: 'bold', 
          halign: 'center', 
          valign: 'middle',
          fillColor: [241, 245, 249],
          textColor: [0, 0, 0],
          cellPadding: 2.5
        },
        1: { cellWidth: 49 },
        2: { cellWidth: 49 },
        3: { cellWidth: 49 },
        4: { cellWidth: 49 },
        5: { cellWidth: 49 }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const weekKey = Object.keys(weeksMap)[data.row.index];
          const dayName = weekDaysHeader[data.column.index - 1];
          const dayData = weeksMap[weekKey]?.[dayName];
          if (dayData && dayData.isHoliday) {
            data.cell.styles.fillColor = [254, 226, 226]; // Soft Red Highlight
            data.cell.styles.textColor = [0, 0, 0];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index > 0) {
          const weekKey = Object.keys(weeksMap)[data.row.index];
          const dayName = weekDaysHeader[data.column.index - 1];
          const dayData = weeksMap[weekKey]?.[dayName];

          if (dayData && dayData.dayNumber) {
            // TANGGAL DITAROH DI TENGAH CARD (BOLD & HITAM)
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 0, 0);
            doc.text(String(dayData.dayNumber), data.cell.x + (data.cell.width / 2), data.cell.y + 5.5, { align: 'center' });

            // GARIS PEMBATAS TANGGAL
            doc.setDrawColor(148, 163, 184);
            doc.setLineWidth(0.2);
            doc.line(data.cell.x, data.cell.y + 7.5, data.cell.x + data.cell.width, data.cell.y + 7.5);
          }
        }
      }
    });

    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 6 : 145;

    // CATATAN SESUAI PENGATURAN ADMIN (SINKRON FULL 100%)
    const defaultNotes = [
      "Hadir 15 menit sebelum jam kerja kantor dimulai.",
      "Memastikan kebersihan dan kerapihan ruang pelayanan & sekretariat.",
      "Mengisi serta mengelola Buku Register Tamu / KPM PKH.",
      "Memastikan seluruh peralatan listrik dan pintu locked saat pelayanan berakhir."
    ];
    const notesToRender = (config.piketNotes && Array.isArray(config.piketNotes) && config.piketNotes.length > 0) 
      ? config.piketNotes 
      : defaultNotes;

    const cardHeight = Math.max(34, 12 + (notesToRender.length * 5.5));

    // CARD ELEGANT: Catatan & Petunjuk Tugas Piket
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, finalY, 175, cardHeight, 3, 3, 'FD');

    // Header Card Catatan
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(14, finalY, 175, 7, 3, 3, 'F');
    doc.rect(14, finalY + 4, 175, 3, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('CATATAN & PETUNJUK TUGAS PIKET (PENGATURAN ADMIN):', 18, finalY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);

    notesToRender.forEach((note, nIdx) => {
      doc.text(`${nIdx + 1}. ${note}`, 18, finalY + 12 + (nIdx * 5));
    });

    // CARD ELEGANT: Blok Penandatangan / Koordinator
    const signerTitle = config.signerTitle || 'Koordinator Kabupaten Tapin';
    const signerName = config.signerName || 'M. Zaen Syachrullah';
    const signatureImg = config.signerSignatureImg;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`Rantau, ${new Date().getDate()} ${monthName} ${year}`, 215, finalY + 5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(signerTitle, 215, finalY + 10);

    if (signatureImg) {
      try {
        doc.addImage(signatureImg, 'PNG', 215, finalY + 11, 30, 14, undefined, 'FAST');
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(signerName, 215, finalY + 29);
      } catch (err) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.text(signerName, 215, finalY + 25);
      }
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(signerName, 215, finalY + 25);
    }

    doc.save(`Jadwal_Piket_PKH_Tapin_${monthName}_${year}.pdf`);
  } catch (error) {
    console.error("Gagal export PDF Piket:", error);
  }
}

export function exportAgendaToPDF(agendas) {
  try {
    const doc = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4',
      compress: true
    });

    // Header Laporan Agenda
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 0, 210, 30, 'F');

    // Aksen Garis Hitam
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 29, 210, 1, 'F');

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.text('AGENDA KEGIATAN SDM PKH TAPIN', 105, 18, { align: 'center' });

    const tableRows = agendas.map((ag) => [
      ag.date || '-',
      ag.time || '-',
      ag.title || '-',
      ag.category || '-',
      `Desa ${ag.desa || '-'}, Kec. ${ag.kecamatan || '-'}`,
      ag.isSupervisiKatim ? 'YA (Katim)' : 'Tidak'
    ]);

    autoTable(doc, {
      startY: 35,
      head: [['Tanggal', 'Jam', 'Kegiatan', 'Kategori', 'Lokasi', 'Supervisi Katim']],
      body: tableRows,
      theme: 'grid',
      headStyles: { 
        fillColor: [226, 232, 240], 
        textColor: [0, 0, 0], 
        fontStyle: 'bold',
        halign: 'center' 
      },
      bodyStyles: { 
        fontSize: 8.5,
        textColor: [0, 0, 0] 
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 25 },
        1: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 25 }
      }
    });

    doc.save(`Agenda_Kegiatan_SDM_PKH_Tapin.pdf`);
  } catch (error) {
    console.error("Gagal export PDF Agenda:", error);
  }
}