import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClock } from '@fortawesome/free-solid-svg-icons';

export default function CountdownCard({ title, targetDate, assignee }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTime = () => {
      const difference = new Date(targetDate) - new Date();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="p-5 rounded-3xl bg-slate-900/60 border border-indigo-500/30 backdrop-blur-xl shadow-3d-glass transform hover:-translate-y-1 transition-all">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h4 className="font-bold text-lg text-indigo-200">{title}</h4>
          <p className="text-xs text-slate-400">Penanggung Jawab: {assignee}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
          <FontAwesomeIcon icon={faClock} />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 text-center mt-4">
        {[
          { label: 'Hari', val: timeLeft.days },
          { label: 'Jam', val: timeLeft.hours },
          { label: 'Menit', val: timeLeft.minutes },
          { label: 'Detik', val: timeLeft.seconds }
        ].map((item, idx) => (
          <div key={idx} className="p-2 rounded-2xl bg-slate-950/80 border border-white/10 shadow-inner">
            <span className="block text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
              {String(item.val).padStart(2, '0')}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}