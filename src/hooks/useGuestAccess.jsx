import { useState } from 'react';
import useAuthStore from '../context/AuthContext';

export const useGuestAccess = () => {
  const authUser = useAuthStore((s) => s.user);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState('');

  const isGuest = authUser?.isGuest === true || authUser?.role === 'guest';

  const checkGuestAccess = (featureName = 'this feature') => {
    if (isGuest) {
      setBlockedFeature(featureName);
      setShowGuestModal(true);
      return false; // Access denied
    }
    return true; // Access granted
  };

  const closeGuestModal = () => {
    setShowGuestModal(false);
    setBlockedFeature('');
  };

  return {
    isGuest,
    showGuestModal,
    blockedFeature,
    checkGuestAccess,
    closeGuestModal
  };
};
