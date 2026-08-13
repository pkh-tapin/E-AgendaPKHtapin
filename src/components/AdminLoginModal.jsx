import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faKey, faTimes } from '@fortawesome/free-solid-svg-icons';
import { useToast } from '../context/ToastContext';

export default function AdminLoginModal({ isOpen, onClose, onSuccess }) {
  const [password, setPassword] = useState('');
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (password === 'adminPKH8') {
      onSuccess();
      setPassword('');
      onClose();
      showToast('Akses Administrator berhasil dibuka!', 'success');
    } else {
      showToast('Password Admin salah!', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md">
      <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900 border border-indigo-500/40 shadow-3d-glass relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 text-2xl shadow-3d-glass">
            <FontAwesomeIcon icon={faLock} />
          </div>
          <h3 className="text-xl font-extrabold text-white">Otentikasi Administrator</h3>
          <p className="text-xs text-slate-400 mt-1">Masukkan password khusus untuk mengelola sistem</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <FontAwesomeIcon icon={faKey} className="absolute left-4 top-3.5 text-slate-400 text-sm" />
            <input
              type="password"
              placeholder="Masukkan Password Admin"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-950/80 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-bold text-sm shadow-3d-button active:shadow-3d-button-active transition-all"
          >
            Masuk Mode Admin
          </button>
        </form>
      </div>
    </div>
  );
}