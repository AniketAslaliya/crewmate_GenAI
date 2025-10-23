import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import useAuthStore from "../context/AuthContext";

const Sidebar = () => {
  const navigate = useNavigate();
  const authUser = useAuthStore((s) => s.user) || {};
  const logout = useAuthStore((s) => s.logout);

  const go = (path, opts = {}) => {
    // allow feature hint via query param for Home
    if (opts.feature) {
      navigate(`/home?feature=${opts.feature}`);
      return;
    }
    navigate(path);
  };

  const isLawyer = authUser?.role === 'lawyer';
  // server-side authoritative onboarded flag preferred; fall back to profile heuristics
  const isOnboarded = Boolean(authUser?.onboarded) || Boolean((authUser?.bio && authUser.bio.length > 0) || (authUser?.specialties && authUser.specialties.length > 0));

  return (
  <aside className={`w-72 border-r flex flex-col py-10 px-6 flex-shrink-0 bg-surface`} style={{backdropFilter: 'blur(6px)'}}>
    <div className="mb-12">
  <h2 className="text-2xl font-semibold mb-6 tracking-wide text-primary">Features</h2>

        <button
          className={`mb-4 w-full flex items-center px-5 py-3 rounded-md text-left font-medium motion-safe hover:translate-y-[-2px] text-primary bg-transparent`} 
          onClick={() => go('/home')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
          </svg>
          Dashboard
        </button>

        <button
          className={`mb-4 w-full flex items-center px-5 py-3 rounded-md text-left font-medium motion-safe text-primary bg-transparent`} 
          onClick={() => go('/home', { feature: 'chatpdf' })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.414l3.707 3.707A2 2 0 0116 6.586V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0-3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0-3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          Legal Desks
        </button>

        {/* For non-lawyers show Find Lawyers; lawyers should not see Find in sidebar */}
        {!isLawyer && (
            <button
            className={`mb-4 w-full flex items-center px-5 py-3 rounded-md text-left font-medium motion-safe text-primary bg-transparent`} 
            onClick={() => go('/find-lawyer')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z" />
            </svg>
            Find Lawyers
          </button>
        )}

        {isLawyer && (
          <>
            {/* If lawyer is NOT onboarded, show Become a Lawyer link (no edit) */}
            {!isOnboarded && (
              <button className="mb-4 w-full flex items-center px-5 py-3 rounded-md text-left font-medium motion-safe text-primary bg-transparent" onClick={() => go('/onboard-lawyer')}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h3v2h-3v3h-2v-3H8v-2h3V8h2v5z" />
                </svg>
                Become a Lawyer
              </button>
            )}

            {/* Requests always visible to lawyers */}
            <button className="mb-4 w-full flex items-center px-5 py-3 rounded-md text-left font-medium motion-safe text-primary bg-transparent" onClick={() => go('/lawyer/requests')}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a5 5 0 00-5 5v1H6a2 2 0 00-2 2v7a2 2 0 002 2h12a2 2 0 002-2v-7a2 2 0 00-2-2h-1V7a5 5 0 00-5-5z" />
              </svg>
              Requests
            </button>
          </>
        )}
      </div>

      <div className="mt-auto flex flex-col items-center">
        <img
          src={authUser?.picture || `https://avatar.vercel.sh/${authUser?._id || 'guest'}.png`}
          alt="Profile"
          className="w-16 h-16 rounded-full mb-3 shadow-lg"
          style={{ border: '2px solid rgba(0,0,0,0.04)' }}
        />
        <span className="text-lg font-medium text-primary">{authUser?.name || 'Guest'}</span>
        <motion.button
          onClick={() => { logout(); navigate('/login'); }}
          className="text-xs text-red-500 hover:text-red-700 motion-safe mt-2 p-1"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          Logout
        </motion.button>
      </div>
    </aside>
  );
};

export default Sidebar;
