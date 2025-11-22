import React from "react";
// framer-motion not used in this component
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../context/AuthContext";
import { formatDisplayName } from '../utils/name';
// icons: outline vs filled for selected state
import { MdOutlineHome, MdHome, MdOutlineDescription, MdDescription, MdOutlinePerson, MdPerson, MdOutlineAddCircle, MdAddCircle, MdOutlineNotifications, MdNotifications, MdChevronLeft, MdChevronRight, MdLightbulb, MdOutlineLightbulb, MdAdminPanelSettings, MdOutlineAdminPanelSettings } from 'react-icons/md';
import InitialAvatar from './InitialAvatar';
import useIsMobile from '../hooks/useIsMobile';
import { MdOutlineDocumentScanner } from "react-icons/md";
import { RiUserSearchLine } from "react-icons/ri";
import { RiUserSearchFill } from "react-icons/ri";
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
  const isAdmin = authUser?.role === 'admin';
  const isGuest = authUser?.isGuest === true || authUser?.role === 'guest';
  // server-side authoritative onboarded flag preferred; fall back to profile heuristics
  const isOnboarded = Boolean(authUser?.onboarded) || Boolean((authUser?.bio && authUser.bio.length > 0) || (authUser?.specialties && authUser.specialties.length > 0));

  const go = (path, opts = {}) => {
    if (opts.feature) {
      navigate(`/home?feature=${opts.feature}`);
      return;
    }
    navigate(path);
  };

  const isMobile = useIsMobile();

  const IconBtn = ({ onClick, active, label, icon, labelText }) => {
    const handleClick = () => {
      try {
        onClick && onClick();
      } catch (e) {
        // ignore
      }
      // close sidebar on mobile after navigation
      if (isMobile) {
        try {
          toggleSidebar();
        } catch (e) {
          // ignore
        }
      }
    };

    return (
      <button onClick={handleClick} className={`w-full flex items-center ${isOpen ? 'gap-3 px-4 py-2' : 'justify-center py-2'} rounded-lg transition-colors ${active ? 'bg-card text-primary' : 'text-primary/80 hover:bg-neutral-10'}`} aria-label={label} title={label}>
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
           <IconBtn onClick={() => go('/find-lawyer')} active={pathname.startsWith('/find-lawyer')} label="Find Lawyers" icon={pathname.startsWith('/find-lawyer') ? <RiUserSearchFill size={20} /> : <RiUserSearchLine size={20} />} labelText="Find Lawyers" />
        )}

        {/* Chat entries: show role-appropriate chat shortcuts */}
        {!isLawyer && (
          <IconBtn onClick={() => go('/chats?target=lawyer')} active={pathname.startsWith('/chats')} label="Chat with Lawyer" icon={pathname.startsWith('/chats') ? <MdPerson size={20} /> : <MdOutlinePerson size={20} />} labelText="Chat with Lawyer" />
        )}

        {isLawyer && (
          <IconBtn onClick={() => go('/chats?target=client')} active={pathname.startsWith('/chats')} label="Chat with Clients" icon={pathname.startsWith('/chats') ? <MdPerson size={20} /> : <MdOutlinePerson size={20} />} labelText="Chat with Clients" />
        )}

        {isLawyer && authUser?.verificationStatus !== 'approved' && (
          <IconBtn 
            onClick={() => go('/onboard-lawyer')} 
            active={pathname.startsWith('/onboard-lawyer')} 
            label={(isOnboarded && (authUser?.verificationStatus === 'pending' || authUser?.verificationStatus === 'rejected')) ? 'Application Status' : 'Become a lawyer'} 
            icon={pathname.startsWith('/onboard-lawyer') ? <MdAddCircle size={20} /> : <MdOutlineAddCircle size={20} />} 
            labelText={(isOnboarded && (authUser?.verificationStatus === 'pending' || authUser?.verificationStatus === 'rejected')) ? 'Application Status' : 'Become a Lawyer'} 
          />
        )}

        {isLawyer && (
          <IconBtn onClick={() => go('/lawyer/requests')} active={pathname.startsWith('/lawyer/requests')} label="Requests" icon={pathname.startsWith('/lawyer/requests') ? <MdNotifications size={20} /> : <MdOutlineNotifications size={20} />} labelText="Requests" />
        )}
        {/* Auto-fill forms feature (use provided /form.png) */}
        <IconBtn
          onClick={() => go('/forms/auto-fill')}
          active={pathname.startsWith('/forms/auto-fill')}
          label="AutoFill Forms"
           icon={<MdOutlineDocumentScanner size={20} />}
          labelText="AutoFill Forms"
        />
        {/* General Ask / Quick Guide feature */}
  <IconBtn onClick={() => go('/general-ask')} active={pathname.startsWith('/general-ask')} label="Quick Guide" icon={pathname.startsWith('/general-ask') ? <MdLightbulb size={20} /> : <MdOutlineLightbulb size={20} />} labelText="Quick Guide" />
        
        {/* Admin Panel - Only visible to admin users */}
        {isAdmin && (
          <IconBtn onClick={() => go('/admin')} active={pathname.startsWith('/admin')} label="Admin Panel" icon={pathname.startsWith('/admin') ? <MdAdminPanelSettings size={20} /> : <MdOutlineAdminPanelSettings size={20} />} labelText="Admin Panel" />
        )}
      </nav>

  <div className="flex-1" />

      <div className="w-full">
        <div className="w-full flex items-center justify-center mb-3">
          <div className="w-10 border-t border-dashed border-gray-200" />
        </div>

        {/* user profile moved to bottom */}
        <div className="w-full p-3 bg-card rounded-md">
          {isGuest && isOpen && (
            <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md">
              <p className="text-xs text-amber-700 font-medium text-center">
                 Exploring as Guest
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full mt-2 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-semibold transition-colors"
              >
                Sign Up to Unlock
              </button>
            </div>
          )}
          
          <div className={`flex items-center ${isOpen ? 'gap-3' : 'justify-center'}`}>
            {authUser?.profileImage?.gcsUrl || authUser?.picture ? (
              <img
                src={authUser?.profileImage?.gcsUrl || authUser.picture}
                alt={authUser.name}
                className={`${isOpen ? 'w-10 h-10' : 'w-[50px] h-[30px]'} rounded-md object-cover flex-shrink-0`}
                onError={e => { e.target.style.display = 'none'; e.target.parentNode.querySelector('.sidebar-fallback-avatar').style.display = 'block'; }}
              />
            ) : null}
            <span className="sidebar-fallback-avatar" style={{display: (!authUser?.profileImage?.gcsUrl && !authUser?.picture) ? 'block' : 'none'}}>
              <InitialAvatar name={authUser?.name} className={`${isOpen ? 'w-10 h-10' : 'w-[50px] h-[30px]'} rounded-md flex-shrink-0`} />
            </span>
            {isOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-primary truncate">{formatDisplayName(authUser?.name) || 'Guest'}</div>
                <div className="flex items-center gap-2">
                  <div className="text-xs text-primary/60 truncate">
                    {isGuest ? ' Guest' : authUser?.role === 'admin' ? 'Admin' : authUser?.role === 'lawyer' ? (isOnboarded ? 'Lawyer' : 'Lawyer') : (authUser?.role ? 'Helpseeker' : 'Guest')}
                  </div>
                  {authUser?.role === 'lawyer' && isOnboarded && authUser?.verificationStatus && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      authUser.verificationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      authUser.verificationStatus === 'approved' ? 'bg-green-100 text-green-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {authUser.verificationStatus === 'pending' ? '⏳ Pending' :
                       authUser.verificationStatus === 'approved' ? '✓ Verified' :
                       '✗ Rejected'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Profile & Support Buttons - Hidden for guests */}
          {isOpen && !isGuest && (
            <>
              <button
                onClick={() => navigate('/profile')}
                className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-md transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                View Profile
              </button>
              <button
                onClick={() => navigate('/support')}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-md transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Support
              </button>
            </>
          )}
        </div>

        <div className="mt-3">
          <button onClick={() => { logout(); navigate('/login'); }} className={`w-full flex items-center ${isOpen ? 'justify-center gap-2 px-4' : 'justify-center'} py-2 rounded-md text-primary/80 hover:bg-gneutral510`}>
<img className="w-4 h-4" src="/logout-svgrepo-com.svg" alt="Logout" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
