import React from "react";
// framer-motion not used in this component
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../context/AuthContext";
import { formatDisplayName } from '../utils/name';
// icons: outline vs filled for selected state
import { MdOutlineHome, MdHome, MdOutlineDescription, MdDescription, MdOutlinePerson, MdPerson, MdOutlineAddCircle, MdAddCircle, MdOutlineNotifications, MdNotifications, MdSearch, MdChevronLeft, MdChevronRight, MdLightbulb, MdOutlineLightbulb } from 'react-icons/md';
import InitialAvatar from './InitialAvatar';

const Sidebar = ({ isOpen = true, toggleSidebar = () => {} }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useAuthStore((s) => s.user) || {};
  const logout = useAuthStore((s) => s.logout);

  // Sidebar is fixed-expanded for this project (no collapse)

  // derive selected state from location (path or ?feature)
  const qp = new URLSearchParams(location.search);
  const feature = qp.get('feature');
  const pathname = location.pathname || '';

  const isLawyer = authUser?.role === 'lawyer';
  // server-side authoritative onboarded flag preferred; fall back to profile heuristics
  const isOnboarded = Boolean(authUser?.onboarded) || Boolean((authUser?.bio && authUser.bio.length > 0) || (authUser?.specialties && authUser.specialties.length > 0));

  const go = (path, opts = {}) => {
    if (opts.feature) {
      navigate(`/home?feature=${opts.feature}`);
      return;
    }
    navigate(path);
  };

  const IconBtn = ({ onClick, active, label, icon, labelText }) => {
    return (
      <button onClick={onClick} className={`w-full flex items-center ${isOpen ? 'gap-3 px-4 py-2' : 'justify-center py-2'} rounded-lg transition-colors ${active ? 'bg-card text-primary' : 'text-primary/80 hover:bg-gray-50'}`} aria-label={label} title={label}>
        <span className="text-lg flex items-center">{icon}</span>
        {isOpen && <span className="text-sm font-medium">{labelText}</span>}
      </button>
    );
  };

  return (
    // sidebar inside layout: can be collapsed/expanded
  <aside className={`${isOpen ? 'w-72 px-6 py-8' : 'w-16 px-2 py-4'} relative z-20 flex flex-col flex-shrink-0 bg-surface border-r h-screen overflow-hidden transition-all duration-200`} style={{ backdropFilter: 'blur(6px)' }}>
      {/* App brand at top */}
      <div className="flex items-center justify-between gap-3 mb-8">
        <div className="flex items-center gap-3">
          
          {isOpen && (
            <div className="leading-tight">
              <div className="text-2xl font-semibold" style={{ color: 'var(--color-primary)' }}>Legal SahAI</div>
              <div className="text-[11px] text-neutral-500">AI Legal Assistant</div>
            </div>
          )}
        </div>
        <div>
          <button onClick={toggleSidebar} className="p-2 rounded-md hover:bg-gray-100" title={isOpen ? 'Collapse' : 'Expand'}>
            {isOpen ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
          </button>
        </div>
      </div>

      
      

      <nav className={`space-y-2 mt-2` }>
        <IconBtn onClick={() => go('/home')} active={feature === null && pathname.startsWith('/home')} label="Home" icon={feature === null && pathname.startsWith('/home') ? <MdHome size={20} /> : <MdOutlineHome size={20} />} labelText="Home" />

  <IconBtn onClick={() => go('/legal-desk')} active={feature === 'chatpdf' || window.location.pathname.startsWith('/legal-desk')} label="Legal Desks" icon={feature === 'chatpdf' ? <MdDescription size={20} /> : <MdOutlineDescription size={20} />} labelText="Legal Desks" />

        {!isLawyer && (
          <IconBtn onClick={() => go('/find-lawyer')} active={pathname.startsWith('/find-lawyer')} label="Find Lawyers" icon={pathname.startsWith('/find-lawyer') ? <MdPerson size={20} /> : <MdOutlinePerson size={20} />} labelText="Find Lawyers" />
        )}

        {/* Chat entries: show role-appropriate chat shortcuts */}
        {!isLawyer && (
          <IconBtn onClick={() => go('/chats?target=lawyer')} active={pathname.startsWith('/chats')} label="Chat with Lawyer" icon={pathname.startsWith('/chats') ? <MdPerson size={20} /> : <MdOutlinePerson size={20} />} labelText="Chat with Lawyer" />
        )}

        {isLawyer && (
          <IconBtn onClick={() => go('/chats?target=client')} active={pathname.startsWith('/chats')} label="Chat with Clients" icon={pathname.startsWith('/chats') ? <MdPerson size={20} /> : <MdOutlinePerson size={20} />} labelText="Chat with Clients" />
        )}

        {isLawyer && !isOnboarded && (
          <IconBtn onClick={() => go('/onboard-lawyer')} active={pathname.startsWith('/onboard-lawyer')} label="Become a lawyer" icon={pathname.startsWith('/onboard-lawyer') ? <MdAddCircle size={20} /> : <MdOutlineAddCircle size={20} />} labelText="Become a Lawyer" />
        )}

        {isLawyer && (
          <IconBtn onClick={() => go('/lawyer/requests')} active={pathname.startsWith('/lawyer/requests')} label="Requests" icon={pathname.startsWith('/lawyer/requests') ? <MdNotifications size={20} /> : <MdOutlineNotifications size={20} />} labelText="Requests" />
        )}
        {/* Auto-fill forms feature (use provided /form.png) */}
        <IconBtn
          onClick={() => go('/forms/auto-fill')}
          active={pathname.startsWith('/forms/auto-fill')}
          label="AutoFill Forms"
          icon={<img src="/form.png" alt="Forms" className="w-5 h-5" />}
          labelText="AutoFill Forms"
        />
        {/* General Ask / Quick Guide feature */}
  <IconBtn onClick={() => go('/general-ask')} active={pathname.startsWith('/general-ask')} label="Quick Guide" icon={pathname.startsWith('/general-ask') ? <MdLightbulb size={20} /> : <MdOutlineLightbulb size={20} />} labelText="Quick Guide" />
      </nav>

  <div className="flex-1" />

      <div className="w-full">
        <div className="w-full flex items-center justify-center mb-3">
          <div className="w-10 border-t border-dashed border-gray-200" />
        </div>

        {/* user profile moved to bottom */}
        <div className="flex items-center gap-3 p-3 bg-card rounded-md">
          <InitialAvatar name={authUser?.name} className="w-10 h-10 rounded-md" />
          {isOpen && (
            <div className="flex-1">
                <div className="text-sm font-medium text-primary">{formatDisplayName(authUser?.name) || 'Guest'}</div>
              <div className="text-xs text-primary/60">{authUser?.role === 'lawyer' ? (isOnboarded ? 'Onboarded Lawyer' : 'Lawyer') : (authUser?.role ? 'Helpseeker' : 'Guest')}</div>
            </div>
          )}
        </div>

        <div className="mt-3">
          <button onClick={() => { logout(); navigate('/login'); }} className={`w-full flex items-center ${isOpen ? 'justify-center gap-2 px-4' : 'justify-center'} py-2 rounded-md text-primary/80 hover:bg-gray-50`}>
<img className="w-4 h-4" src="/logout-svgrepo-com.svg" alt="Logout" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
