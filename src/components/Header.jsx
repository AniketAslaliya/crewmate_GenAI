import React from 'react';
import { motion } from 'framer-motion';
import useAuthStore from '../context/AuthContext';

const Header = () => {
  const authUser = useAuthStore((s) => s.user);

  return (
    <header className="w-full border-b bg-[rgba(255,255,255,0.62)] backdrop-blur-md fixed top-0 left-0 right-0 z-40" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 select-none">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{ background: 'linear-gradient(180deg, var(--palette-1), rgba(0,0,0,0.06))', color: 'white' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>Legal SahAI</div>
                <div className="text-[11px] text-muted">AI Legal Assistant</div>
              </div>
            </div>

            <div className="hidden md:flex items-center bg-surface border rounded-full px-3 py-2" style={{ borderColor: 'var(--palette-3)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-3 text-[var(--palette-3)]" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>
              <div className="text-sm text-[var(--color-subtext)] select-none">Search Legal Desks, clauses, files...</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2">
              <button className="px-3 py-1 rounded-full text-sm text-muted border border-transparent bg-transparent pointer-events-none">Docs</button>
              <button className="px-3 py-1 rounded-full text-sm text-muted border border-transparent bg-transparent pointer-events-none">Templates</button>
              <button className="px-3 py-1 rounded-full text-sm text-muted border border-transparent bg-transparent pointer-events-none">Help</button>
            </div>

            <div className="flex items-center gap-3">
              {authUser ? (
                <div className="flex items-center gap-3 select-none">
                  <div className="text-right mr-1 hidden sm:block">
                    <div className="text-sm font-medium text-primary">{authUser.name}</div>
                    <div className="text-xs text-muted">{authUser.role === 'lawyer' ? 'Lawyer' : 'Helpseeker'}</div>
                  </div>
                  <motion.img src={authUser.picture || `https://avatar.vercel.sh/${authUser._id || 'guest'}.png`} alt="profile" className="w-10 h-10 rounded-full border" whileHover={{ scale: 1.01 }} style={{ borderColor: 'rgba(0,0,0,0.06)' }} />
                </div>
              ) : (
                <div className="flex items-center gap-2 select-none">
                  <button className="px-4 py-2 rounded-full bg-[linear-gradient(90deg,var(--palette-1),var(--palette-2))] text-white text-sm font-medium pointer-events-none opacity-95">Sign in</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
