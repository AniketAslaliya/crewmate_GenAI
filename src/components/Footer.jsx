import React from 'react';

const Footer = () => {
  return (
    <footer className="w-full border-t mt-6 py-3 text-center text-muted text-sm bg-surface" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
      © {new Date().getFullYear()} Legal SahAI. All rights reserved.
    </footer>
  );
};

export default Footer;
