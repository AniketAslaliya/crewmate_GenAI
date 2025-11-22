import React from 'react';

const GRADIENTS = [
  'linear-gradient(135deg, #6366f1 0%, #a21caf 100%)', // indigo to purple
  'linear-gradient(135deg, #10b981 0%, #059669 100%)', // green to emerald
  'linear-gradient(135deg, #f59e42 0%, #f43f5e 100%)', // yellow to red
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // pink to rose
  'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)', // blue to cyan
  'linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%)', // violet to fuchsia
];

function pickGradient(name) {
  if (!name) return GRADIENTS[0];
  const s = String(name).trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

const InitialAvatar = ({ name, className = 'w-10 h-10 rounded-full', style = {}, fallbackText = null }) => {
  const initial = name && typeof name === 'string' && name.trim().length > 0 ? name.trim().charAt(0).toUpperCase() : (fallbackText || '?');
  const bg = pickGradient(name);

  return (
    <div
      className={`${className} inline-flex items-center justify-center font-semibold`}
      style={{
        background: bg,
        color: '#fff',
        userSelect: 'none',
        boxShadow: '0 2px 8px 0 rgba(0,0,0,0.07)',
        ...style,
      }}
      aria-hidden={false}
      title={name || 'User'}
    >
      <span className="select-none" style={{textShadow: '0 1px 4px rgba(0,0,0,0.18)', fontSize: '1.2em'}}>{initial}</span>
    </div>
  );
};

export default InitialAvatar;
