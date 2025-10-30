export function formatDisplayName(name) {
  if (!name || typeof name !== 'string') return '';
  // Trim and collapse whitespace
  const parts = name.trim().split(/\s+/);
  return parts.map(p => {
    // preserve single-letter initials as uppercase
    if (p.length === 1) return p.toUpperCase();
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
  }).join(' ');
}
