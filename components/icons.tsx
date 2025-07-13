
import React from 'react';

export const CircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

export const SquareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <rect x="3" y="3" width="18" height="18" />
  </svg>
);

export const TriangleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2 L2 22 H22 Z" />
  </svg>
);

export const FireIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M12 2C8.1 6.1 6 9.4 6 12.3c0 3.7 2.7 6.4 6 6.4s6-2.7 6-6.4c0-2.9-2.1-6.2-6-10.3z"/>
  </svg>
);

export const ColdIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M12 2.5l-2.4 2.4-1.1-1.1-1.4 1.4 1.1 1.1-2.4 2.4-2.5-2.4-1.4 1.4 2.4 2.4-1.1 1.1 1.4 1.4 1.1-1.1 2.4 2.4v3.5h3.5l2.4-2.4 1.1 1.1 1.4-1.4-1.1-1.1 2.4-2.4 2.5 2.4 1.4-1.4-2.4-2.4 1.1-1.1-1.4-1.4-1.1 1.1-2.4-2.4v-3.5h-3.5zM12 16.5c-2.49 0-4.5-2.01-4.5-4.5s2.01-4.5 4.5-4.5 4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5z"/>
    </svg>
);

export const ElectricIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
        <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
    </svg>
);


export const HeartIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path
      fillRule="evenodd"
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      clipRule="evenodd"
    />
  </svg>
);

export const CoinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" />
    <path d="M12 6c-2.21 0-4 1.79-4 4h1.5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5c0 .74-.33 1.39-.83 1.87-.5.48-1.17.83-1.17 1.63h1.5c0-.66.52-1.2 1-1.68.7-.68 1-1.63 1-2.82 0-2.21-1.79-4-4-4zM12 17c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z" />
  </svg>
);

export const ResearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 16v-5l-4 4-1.41-1.41L9.17 12 5.59 8.41 7 7l4 4V6h2v5l4-4 1.41 1.41L14.83 12l3.58 3.59L17 17l-4-4v5h-2z"/>
    </svg>
);
