import React from 'react';
import { Category } from '../types';

interface CategoryFilterProps {
  activeCategory: string;
  categories: string[];
  onSelectCategory: (category: string) => void;
  counts: Record<string, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
  activeCategory, 
  categories,
  onSelectCategory,
  counts 
}) => {
  // Always ensure 'All' is at the front
  const displayCategories = [Category.ALL, ...categories.filter(c => c !== Category.ALL)];

  return (
    <div className="relative w-full max-w-4xl mx-auto group">
      {/* Scrollable Container */}
      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar px-4 w-full justify-start items-center scroll-smooth">
        {displayCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => onSelectCategory(cat)}
            className={`px-4 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-2 border font-black text-[10px] uppercase tracking-widest group/btn ${
              activeCategory === cat
                ? "bg-white border-white text-black shadow-lg shadow-white/5 scale-105"
                : "bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300"
            }`}
          >
            <span>{cat}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-mono ${
              activeCategory === cat ? "bg-black/10" : "bg-white/5 text-slate-600 group-hover/btn:text-slate-400"
            }`}>
              {counts[cat] || 0}
            </span>
          </button>
        ))}
      </div>
      
      {/* Visual Indicator of Scrollability (Fades) */}
      <div className="absolute top-0 bottom-2 left-0 w-8 bg-gradient-to-r from-[#0f172a] to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="absolute top-0 bottom-2 right-0 w-8 bg-gradient-to-l from-[#0f172a] to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
};
