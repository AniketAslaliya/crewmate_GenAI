import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

const MermaidMindMap = ({ chartCode }) => {
  const containerRef = useRef(null);
  const [svgContent, setSvgContent] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    // 1. Initialize Mermaid with updated config - Custom color palette
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      logLevel: 'debug',
      mindmap: {
        padding: 20,
        maxNodeWidth: 150,
        useMaxWidth: true,
      },
      themeVariables: {
        // Root node - Deep purple (#3d315b) with white text
        primaryColor: '#3d315b',
        primaryTextColor: '#FFFFFF',
        primaryBorderColor: '#2a2240',
        
        // Connecting lines - Medium purple-gray
        lineColor: '#444b6e',
        
        // Level 1 nodes - Dark slate blue (#444b6e) with white text
        secondaryColor: '#444b6e',
        secondaryTextColor: '#FFFFFF',
        secondaryBorderColor: '#363b56',
        
        // Level 2 nodes - Sage green (#708b75) with white text
        tertiaryColor: '#708b75',
        tertiaryTextColor: '#FFFFFF',
        tertiaryBorderColor: '#5d7360',
        
        // Additional levels - Light green and yellow-green
        node0Fill: '#9ab87a',
        node0TextColor: '#1F2937',
        node1Fill: '#3d315b',
        node1TextColor: '#FFFFFF',
        node2Fill: '#708b75',
        node2TextColor: '#FFFFFF',
        node3Fill: '#444b6e',
        node3TextColor: '#FFFFFF',
        
        // Default node colors
        nodeBorder: '#3d315b',
        mainBkg: '#9ab87a',
        textColor: '#1F2937',
        
        // Text and backgrounds
        noteTextColor: '#1F2937',
        noteBkgColor: '#f8f991',
        fontSize: '16px',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      },
    });

    const sanitizeMindmapCode = (code) => {
      // Split into lines
      const lines = code.split('\n');
      const sanitizedLines = lines.map((line, index) => {
        // Keep the first line (mindmap declaration) as is
        if (index === 0) return line;
        
        // Detect indentation level
        const match = line.match(/^(\s*)/);
        const indent = match ? match[1] : '';
        const content = line.trim();
        
        if (!content) return line;
        
        // Wrap content in quotes if it contains special characters or is complex
        // Special chars that break Mermaid: () [] {} : - / \ | & % $ # @ ! ? ; , .
        const hasSpecialChars = /[()[\]{}:\-/\\|&%$#@!?;,.]/.test(content);
        const isAlreadyQuoted = /^["'].*["']$/.test(content);
        const isRootNode = /^root\(\(.*\)\)$/.test(content);
        
        if (isRootNode) {
          // Extract text from root((text)) and re-wrap safely
          const rootMatch = content.match(/^root\(\((.*)\)\)$/);
          if (rootMatch) {
            const rootText = rootMatch[1];
            const cleanText = rootText.replace(/[()[\]{}]/g, '').substring(0, 50); // Limit length
            return `${indent}root((${cleanText}))`;
          }
        } else if (hasSpecialChars && !isAlreadyQuoted) {
          // Remove problematic characters and wrap in quotes
          const cleanContent = content.replace(/[()[\]{}]/g, '').substring(0, 80); // Limit length
          return `${indent}"${cleanContent}"`;
        }
        
        return line;
      });
      
      return sanitizedLines.join('\n');
    };

    const renderChart = async () => {
      if (!chartCode) {
        setError('No chart code provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setSvgContent('');
        setError(null);

        console.log('Original mindmap code:', chartCode);

        // Sanitize the chart code to fix special characters
        const sanitizedCode = sanitizeMindmapCode(chartCode.trim());
        console.log('Sanitized mindmap code:', sanitizedCode);
        
        // Generate a unique ID for this render (required by Mermaid)
        const uniqueId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Render the sanitized code into SVG
        const { svg } = await mermaid.render(uniqueId, sanitizedCode);
        
        // Process SVG to ensure it's responsive and fits container
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, 'image/svg+xml');
        const svgElement = svgDoc.querySelector('svg');
        
        if (svgElement) {
          // Remove fixed width/height, use viewBox for responsiveness
          const width = svgElement.getAttribute('width');
          const height = svgElement.getAttribute('height');
          
          if (width && height) {
            svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
          }
          
          svgElement.removeAttribute('width');
          svgElement.removeAttribute('height');
          svgElement.setAttribute('style', 'max-width: 100%; height: auto;');
          
          const serializer = new XMLSerializer();
          const processedSvg = serializer.serializeToString(svgElement);
          setSvgContent(processedSvg);
        } else {
          setSvgContent(svg);
        }
        
        setIsLoading(false);
        
      } catch (error) {
        console.error('Mermaid Rendering Error:', error);
        console.error('Chart code that failed:', chartCode);
        setError(`Error rendering mind map: ${error.message || 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    renderChart();
  }, [chartCode]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  if (isLoading) {
    return (
      <div className="w-full p-8 flex items-center justify-center bg-white rounded-lg shadow-sm border border-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Rendering mind map...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-600 text-sm font-semibold mb-2">Mind Map Rendering Error</p>
        <p className="text-red-600 text-sm">{error}</p>
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">Show raw data</summary>
          <pre className="mt-2 p-3 bg-white rounded text-xs overflow-x-auto">{chartCode}</pre>
        </details>
      </div>
    );
  }

  return (
    <div className="w-full h-full max-w-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 rounded-lg shadow-sm border border-gray-200 relative overflow-hidden">
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2 border border-gray-300">
        <button
          onClick={handleZoomIn}
          className="p-2 hover:bg-blue-50 rounded-lg transition-colors group"
          title="Zoom In (Scroll Up)"
        >
          <svg className="w-5 h-5 text-gray-700 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
          </svg>
        </button>
        <button
          onClick={handleResetZoom}
          className="p-2 hover:bg-green-50 rounded-lg transition-colors group"
          title="Reset View"
        >
          <svg className="w-5 h-5 text-gray-700 group-hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
          title="Zoom Out (Scroll Down)"
        >
          <svg className="w-5 h-5 text-gray-700 group-hover:text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
        <div className="text-xs text-center text-gray-600 font-medium pt-2 border-t border-gray-200">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Mind Map Container */}
      <div 
        className="w-full h-full overflow-hidden flex items-center justify-center"
        style={{ 
          minHeight: '500px',
          maxHeight: '600px',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          ref={containerRef}
          dangerouslySetInnerHTML={{ __html: svgContent }} 
          className="mermaid-chart transition-transform duration-100"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            userSelect: 'none',
            maxWidth: '100%',
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        />
      </div>

      {/* Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 text-xs text-gray-600 border border-gray-200">
        <p className="font-semibold mb-1">💡 Navigation Tips:</p>
        <p>• <strong>Scroll:</strong> Zoom in/out</p>
        <p>• <strong>Click & Drag:</strong> Pan around</p>
        <p>• <strong>Reset:</strong> Click center button</p>
      </div>
    </div>
  );
};

export default MermaidMindMap;
