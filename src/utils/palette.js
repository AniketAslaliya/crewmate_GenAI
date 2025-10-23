// Small helper to update CSS variables for the palette at runtime.
export function applyPalette(palette = {}){
  // Expected palette keys: p1, p2, p3, p4 (hex colors)
  const root = document.documentElement;
  if(palette.p1) root.style.setProperty('--palette-1', palette.p1);
  if(palette.p2) root.style.setProperty('--palette-2', palette.p2);
  if(palette.p3) root.style.setProperty('--palette-3', palette.p3);
  if(palette.p4) root.style.setProperty('--palette-4', palette.p4);
  // update semantic vars and extras used by the new theme
  const p1 = palette.p1 || getComputedStyle(root).getPropertyValue('--palette-1');
  const p2 = palette.p2 || getComputedStyle(root).getPropertyValue('--palette-2');
  const p3 = palette.p3 || getComputedStyle(root).getPropertyValue('--palette-3');
  const p4 = palette.p4 || getComputedStyle(root).getPropertyValue('--palette-4');
  const p5 = palette.p5 || getComputedStyle(root).getPropertyValue('--palette-5') || '';

  root.style.setProperty('--color-primary', p1);
  root.style.setProperty('--color-muted', p2);
  root.style.setProperty('--color-accent', p5 || p3);
  root.style.setProperty('--color-bg', p4 || '#ffffff');
  root.style.setProperty('--color-surface', 'rgba(255,255,255,0.76)');
}

export const defaultPalette = {
  p1: '#463F3A',
  p2: '#8A817C',
  p3: '#BCB8B1',
  p4: '#F4F3EE',
  p5: '#E0AFA0'
};
