import React from 'react';

export default function ListItem({
  children,
  className = '',
  onClick,
  isLast = false,
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between py-4 ${
        !isLast ? 'border-b border-border-subtle' : ''
      } ${onClick ? 'cursor-pointer hover:bg-surface-interactive/30 px-3 -mx-3 rounded-xl transition-all duration-200' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
