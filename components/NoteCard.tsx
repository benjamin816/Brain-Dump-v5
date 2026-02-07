
import React from 'react';
import { Note, Category, ItemType } from '../types';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete }) => {
  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateStr));
  };

  const getCategoryColor = (cat: Category) => {
    switch (cat) {
      case Category.WORK: return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case Category.PERSONAL: return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case Category.CREATIVE: return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case Category.HEALTH: return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case Category.FINANCE: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case Category.ADMIN: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case Category.SOCIAL: return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
      default: return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
    }
  };

  const getTypeIcon = (type: ItemType) => {
    switch (type) {
      case ItemType.TASK: return 'fa-check-double';
      case ItemType.EVENT: return 'fa-calendar-day';
      case ItemType.INFO: return 'fa-circle-info';
      default: return 'fa-lightbulb';
    }
  };

  return (
    <div className="glass group relative p-7 rounded-[2rem] border-white/5 transition-all hover:bg-white/[0.03] hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40">
      <button 
        onClick={() => onDelete(note.id)}
        className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-600 hover:text-rose-400"
      >
        <i className="fa-solid fa-trash-can"></i>
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${getCategoryColor(note.category)}`}>
          <i className={`fa-solid ${getTypeIcon(note.item_type as ItemType)} text-xs`}></i>
        </div>
        <div className="flex flex-col">
          <span className={`text-[10px] font-black uppercase tracking-wider ${getCategoryColor(note.category).split(' ')[0]}`}>
            {note.category}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">{formatDate(note.created_at_server)}</span>
        </div>
      </div>

      <p className="text-slate-100 text-lg leading-relaxed font-medium mb-6 whitespace-pre-wrap selection:bg-blue-500/50">
        {note.text}
      </p>

      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
        <i className="fa-solid fa-fingerprint"></i>
        <span>{note.id.split('-')[0]}</span>
        {note.time_bucket && note.time_bucket !== 'none' && (
          <span className="ml-auto text-blue-400 flex items-center gap-1">
            <i className="fa-regular fa-clock"></i>
            {note.time_bucket}
          </span>
        )}
      </div>
    </div>
  );
};
