import React from 'react';

const GRADIENTS = [
  'bg-gradient-to-br from-indigo-500 to-purple-600',
  'bg-gradient-to-br from-green-400 to-emerald-600',
  'bg-gradient-to-br from-yellow-400 to-orange-500',
  'bg-gradient-to-br from-pink-500 to-rose-500',
  'bg-gradient-to-br from-blue-500 to-sky-500',
  'bg-gradient-to-br from-violet-500 to-fuchsia-500',
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
      className={`${className} inline-flex items-center justify-center text-white font-semibold ${bg}`}
      style={{ userSelect: 'none', ...style }}
      aria-hidden={false}
      title={name || 'User'}
    >
      <span className="select-none">{initial}</span>
    </div>
  );
};

export default InitialAvatar;
