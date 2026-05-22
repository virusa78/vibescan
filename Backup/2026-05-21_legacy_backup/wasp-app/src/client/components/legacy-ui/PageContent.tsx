import React from 'react';

export default function PageContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`max-w-[1600px] mx-auto p-4 lg:p-8 ${className}`}>
      {children}
    </div>
  );
}
