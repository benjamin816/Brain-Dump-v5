
import React from 'react';
import { Category } from '../types';

interface CategoryFilterProps {
  activeCategory: Category;
  onSelectCategory: (category: Category) => void;
  counts: Record<Category, number>;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({ 
  activeCategory, 
  onSelectCategory,
  counts 
}) => {
  const categories = Object.values(Category);

  return (
    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelectCategory(cat)}
          className={`px-6 py-2.5 rounded-2xl whitespace-nowrap transition-all flex items-center gap-3 border font-bold text-xs uppercase tracking-wider ${
            activeCategory === cat
              ? "bg-white border-white text-black shadow-lg shadow-white/5"
              : "bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300"
          }`}
        >
          <span>{cat}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
            activeCategory === cat ? "bg-black/10" : "bg-white/5"
          }`}>
            {counts[cat] || 0}
          </span>
        </button>
      ))}
    </div>
  );
};
