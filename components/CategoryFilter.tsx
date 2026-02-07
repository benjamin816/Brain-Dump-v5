
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
    <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelectCategory(cat)}
          className={`px-4 py-2 rounded-full whitespace-nowrap transition-all flex items-center gap-2 border ${
            activeCategory === cat
              ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20"
              : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-white"
          }`}
        >
          <span>{cat}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            activeCategory === cat ? "bg-blue-500" : "bg-slate-700"
          }`}>
            {counts[cat] || 0}
          </span>
        </button>
      ))}
    </div>
  );
};
