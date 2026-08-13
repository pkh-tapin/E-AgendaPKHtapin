import React from 'react';

export default function GlassLoader({ text = "Memuat Data Realtime..." }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-2xl">
      {/* 3D Glossy Ring Spinner */}
      <div className="relative flex items-center justify-center w-28 h-28 mb-6">
        {/* Glow Ring Outer */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-500 via-cyan-400 to-purple-600 animate-spin blur-lg opacity-70"></div>
        
        {/* Outer Glass Sphere */}
        <div className="absolute inset-0 rounded-full border-4 border-white/20 bg-white/5 backdrop-blur-md shadow-3d-glass animate-spin"></div>
        
        {/* Inner Counter Rotating Sphere */}
        <div className="w-16 h-16 rounded-full border-4 border-t-indigo-400 border-r-cyan-300 border-b-transparent border-l-purple-400 animate-spin-reverse"></div>
        
        {/* Center Glowing Core */}
        <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-indigo-500 shadow-[0_0_20px_#38bdf8] animate-pulse"></div>
      </div>

      {/* Glossy Text Box */}
      <div className="px-6 py-3 rounded-2xl bg-slate-900/80 border border-white/10 shadow-3d-glass backdrop-blur-xl">
        <p className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-indigo-200 to-purple-300 tracking-wider animate-pulse">
          {text}
        </p>
      </div>
    </div>
  );
}