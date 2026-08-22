"use client"

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface SlidingTabsProps {
  tabs: string[];
  activeTab: number;
  onChange: (index: number) => void;
  className?: string;
}

export function SlidingTabs({ tabs, activeTab, onChange, className }: SlidingTabsProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const moveTo = (idx: number, animate: boolean) => {
    const tab = tabRefs.current[idx];
    const pill = pillRef.current;
    if (!tab || !pill) return;
    const left = tab.offsetLeft;
    const width = tab.offsetWidth;
    
    if (width === 0) return; // Wait for actual layout

    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${left}px)`;
      pill.style.width = `${width}px`;
      // force reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      pill.offsetWidth;
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${left}px)`;
      pill.style.width = `${width}px`;
    }
  };

  useEffect(() => {
    let frameId: number;
    // Delay to ensure layout is fully computed before measuring offsetWidth
    const timeout = setTimeout(() => {
      frameId = window.requestAnimationFrame(() => moveTo(activeTab, false));
    }, 50);

    const onResize = () => moveTo(activeTab, false);
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeout);
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
    };
  }, [activeTab]);

  return (
    <div ref={rootRef} className={cn("relative flex items-center w-full h-full", className)} role="tablist">
      <span 
        ref={pillRef} 
        className="absolute top-0 left-0 h-full w-0 bg-primary rounded-xl shadow-sm z-0 pointer-events-none transition-all duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]" 
        aria-hidden="true" 
      />
      {tabs.map((label, i) => (
        <button
          key={label}
          ref={(el) => { tabRefs.current[i] = el; }}
          type="button"
          className={cn(
            "relative flex-1 h-full appearance-none border-0 bg-transparent cursor-pointer rounded-xl z-10 font-semibold text-xs transition-colors duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
            i === activeTab ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          role="tab"
          aria-selected={i === activeTab}
          onClick={() => { onChange(i); moveTo(i, true); }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
