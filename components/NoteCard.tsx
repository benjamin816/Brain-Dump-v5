
import React from 'react';
import { Note, Category, ItemType } from '../types';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete }) => {
  const formatDate = (serverDate?: string, clientDate?: string) => {
    const dateStr = serverDate || clientDate;
    if (!dateStr) return 'No date';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'No date';
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return 'No date';
    }
  };

  const getCategoryColor = (cat: string = '') => {
    const normalized = cat.toString().trim().toLowerCase();
    switch (normalized) {
      case 'work': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'personal': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case 'creative': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'health': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'finance': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'admin': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      case 'social': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
      default: return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
    }
  };

  const getTypeIcon = (type: string = '') => {
    const normalized = type.toString().trim().toLowerCase();
    switch (normalized) {
      case 'task': return 'fa-check-double';
      case 'event': return 'fa-calendar-day';
      case 'important_info': return 'fa-circle-info';
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
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${getCategoryColor(note.category as string)}`}>
          <i className={`fa-solid ${getTypeIcon(note.item_type as string)} text-xs`}></i>
        </div>
        <div className="flex flex-col">
          <span className={`text-[10px] font-black uppercase tracking-wider ${getCategoryColor(note.category as string).split(' ')[0]}`}>
            {note.category || 'Other'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            {formatDate(note.created_at_server, note.created_at_client)}
          </span>
        </div>
      </div>

      <p className="text-slate-100 text-lg leading-relaxed font-medium mb-6 whitespace-pre-wrap selection:bg-blue-500/50">
        {note.text || 'Empty note content'}
      </p>

      <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
        <i className="fa-solid fa-fingerprint"></i>
        <span>{note.id ? note.id.split('-')[0] : 'N/A'}</span>
        {note.source && (
           <span className="ml-2 px-1.5 py-0.5 rounded bg-white/5 text-[8px]">{note.source}</span>
        )}
        {note.time_bucket && note.time_bucket.toLowerCase() !== 'none' && (
          <span className="ml-auto text-blue-400 flex items-center gap-1">
            <i className="fa-regular fa-clock"></i>
            {note.time_bucket}
          </span>
        )}
      </div>
    </div>
  );
};
