import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface SplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  initialLeftWidth?: number;
  minLeftWidth?: number;
  minRightWidth?: number;
}

export function SplitLayout({
  left,
  right,
  initialLeftWidth = 400,
  minLeftWidth = 250,
  minRightWidth = 400,
}: SplitLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [isXl, setIsXl] = useState(window.innerWidth >= 1280);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setIsXl(window.innerWidth >= 1280);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = e.clientX - containerRect.left;
      const maxLeftWidth = containerRect.width - minRightWidth - 16; // 16px is handle width
      
      if (newLeftWidth >= minLeftWidth && newLeftWidth <= maxLeftWidth) {
        setLeftWidth(newLeftWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, minLeftWidth, minRightWidth]);

  return (
    <div className="flex flex-col xl:flex-row w-full gap-4 xl:gap-0" ref={containerRef}>
      <div 
        className="flex-shrink-0 w-full"
        style={isXl ? { width: leftWidth } : {}}
      >
        {left}
      </div>
      
      <div
        className="hidden xl:flex w-4 shrink-0 cursor-col-resize items-center justify-center group relative z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
      >
        <div className={`h-16 w-1 rounded-full transition-colors ${isDragging ? 'bg-accent-primary' : 'bg-border-hairline group-hover:bg-accent-primary'}`} />
      </div>

      <div className="flex-1 min-w-0 w-full">
        {right}
      </div>
    </div>
  );
}
