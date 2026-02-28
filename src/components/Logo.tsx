import React from 'react';

export const AgriSuriLogo: React.FC<{ className?: string }> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Outer Green Circle */}
        <circle cx="50" cy="50" r="46" stroke="#059669" strokeWidth="3" />
        
        {/* Inner Blue Orbit Path */}
        <path
          d="M20 50C20 33.4315 33.4315 20 50 20C66.5685 20 80 33.4315 80 50C80 66.5685 66.5685 80 50 80"
          stroke="#93c5fd"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* Soil Line */}
        <path
          d="M30 85C40 80 60 80 70 85"
          stroke="#78350f"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* The Plant (Three Leaves) */}
        {/* Stem */}
        <path
          d="M50 82V65"
          stroke="#065f46"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Center Leaf */}
        <path
          d="M50 65C50 65 42 55 50 40C58 55 50 65 50 65Z"
          fill="#10b981"
          stroke="#065f46"
          strokeWidth="1"
        />
        {/* Left Leaf */}
        <path
          d="M48 70C48 70 35 65 35 55C35 45 45 55 48 65"
          fill="#34d399"
          stroke="#065f46"
          strokeWidth="1"
        />
        {/* Right Leaf */}
        <path
          d="M52 70C52 70 65 65 65 55C65 45 55 55 52 65"
          fill="#059669"
          stroke="#065f46"
          strokeWidth="1"
        />

        {/* Satellite */}
        <g transform="translate(75, 30) rotate(45)">
          {/* Solar Panels */}
          <rect x="-8" y="-2" width="6" height="4" fill="#1e3a8a" />
          <rect x="2" y="-2" width="6" height="4" fill="#1e3a8a" />
          {/* Body */}
          <rect x="-2" y="-3" width="4" height="6" rx="1" fill="#475569" />
          {/* Antenna */}
          <path d="M0 3L0 5" stroke="#475569" strokeWidth="1" />
          
          {/* Radio Waves (Animated) */}
          <g className="animate-pulse">
            <path d="M-4 8C-2 10 2 10 4 8" stroke="#3b82f6" strokeWidth="0.5" opacity="0.8" />
            <path d="M-6 10C-3 13 3 13 6 10" stroke="#3b82f6" strokeWidth="0.5" opacity="0.5" />
          </g>
        </g>
      </svg>
    </div>
  );
};
