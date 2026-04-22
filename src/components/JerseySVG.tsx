import React from 'react';

export type JerseyPattern = 'solid' | 'stripes' | 'hoops' | 'halves' | 'chevron' | 'sash' | 'band';

export interface JerseyProps {
  primaryColor: string;
  secondaryColor: string;
  pattern: JerseyPattern;
  width?: number;
  height?: number;
}

export function JerseySVG({ primaryColor, secondaryColor, pattern, width = 48, height = 48 }: JerseyProps) {
  const defsId = React.useId();
  
  return (
    <svg width={width} height={height} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 4px 6px rgba(0,0,0,0.4))' }}>
      <defs>
        {/* Sleeves drop shadow */}
        <filter id={`${defsId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3"/>
        </filter>

        {/* Patterns */}
        {pattern === 'stripes' && (
          <pattern id={`${defsId}-stripes`} width="20" height="100" patternUnits="userSpaceOnUse">
            <rect width="10" height="100" fill={primaryColor} />
            <rect x="10" width="10" height="100" fill={secondaryColor} />
          </pattern>
        )}
        {pattern === 'hoops' && (
          <pattern id={`${defsId}-hoops`} width="100" height="20" patternUnits="userSpaceOnUse">
            <rect width="100" height="10" fill={primaryColor} />
            <rect y="10" width="100" height="10" fill={secondaryColor} />
          </pattern>
        )}
        {pattern === 'halves' && (
          <linearGradient id={`${defsId}-halves`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="50%" stopColor={primaryColor} />
            <stop offset="50%" stopColor={secondaryColor} />
          </linearGradient>
        )}
        <clipPath id={`${defsId}-bodyClip`}>
          <path d="M 25 15 C 35 5, 65 5, 75 15 L 85 92 Q 50 100 15 92 Z" />
        </clipPath>
      </defs>

      {/* Sleeves */}
      <path 
        d="M 15 25 Q -5 10 5 45 Q 15 50 20 25 Z" 
        fill={primaryColor} 
        stroke="rgba(0,0,0,0.2)" strokeWidth="1"
      />
      <path 
        d="M 85 25 Q 105 10 95 45 Q 85 50 80 25 Z" 
        fill={pattern === 'halves' ? secondaryColor : primaryColor} 
        stroke="rgba(0,0,0,0.2)" strokeWidth="1"
      />

      {/* Main Body Base */}
      <path 
        d="M 25 15 C 35 5, 65 5, 75 15 L 85 92 Q 50 100 15 92 Z" 
        fill={primaryColor}
      />

      {/* Body Patterns using clip-path */}
      <g clipPath={`url(#${defsId}-bodyClip)`}>
        {pattern === 'stripes' && <rect width="100" height="100" fill={`url(#${defsId}-stripes)`} />}
        {pattern === 'hoops' && <rect width="100" height="100" fill={`url(#${defsId}-hoops)`} />}
        {pattern === 'halves' && <rect width="100" height="100" fill={`url(#${defsId}-halves)`} />}
        
        {/* Vélez: V Shape (Chevron) */}
        {pattern === 'chevron' && (
          <polygon points="10,20 50,65 90,20 100,20 100,5 50,55 0,5 0,20" fill={secondaryColor} />
        )}
        
        {/* River: Banda cruzada (Sash) */}
        {pattern === 'sash' && (
          <rect x="-30" y="30" width="160" height="24" transform="rotate(-45 50 50)" fill={secondaryColor} />
        )}

        {/* Boca: Franja horizontal (Band) */}
        {pattern === 'band' && (
          <rect x="0" y="42" width="100" height="26" fill={secondaryColor} />
        )}
      </g>

      {/* Main Body Outline on top */}
      <path 
        d="M 25 15 C 35 5, 65 5, 75 15 L 85 92 Q 50 100 15 92 Z" 
        fill="transparent"
        stroke="rgba(0,0,0,0.2)" strokeWidth="1.5"
      />

      {/* Collar */}
      <path 
        d="M 38 12 C 45 25, 55 25, 62 12" 
        fill="transparent" 
        stroke={secondaryColor} strokeWidth="3" strokeLinecap="round"
      />
      
      {/* Sleeve trims */}
      <path d="M 5 45 Q 15 50 20 25" fill="transparent" stroke={secondaryColor} strokeWidth="2" />
      <path d="M 95 45 Q 85 50 80 25" fill="transparent" stroke={secondaryColor} strokeWidth="2" />
    </svg>
  );
}
