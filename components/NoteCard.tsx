
import React from 'react';
import { Note, Category } from '../types';

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onDelete }) => {
  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(ts));
  };

  const getCategoryColor = (cat: Category) => {
    switch (cat) {
      case Category.WORK: return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case Category.PERSONAL: return 'text-green-400 bg-green-400/10 border-green-400/20';
      case Category.IDEAS: return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case Category.TODO: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case Category.HEALTH: return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case Category.FINANCE: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case Category.EVENT: return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="glass group relative p-5 rounded-2xl transition-all hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/20">
      <button 
        onClick={() => onDelete(note.id)}
        className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-slate-500 hover:text-rose-400"
      >
        <i className="fa-solid fa-trash-can"></i>
      </button>

      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getCategoryColor(note.category)}`}>
          {note.category}
        </span>
        <span className="text-[11px] text-slate-500">{formatDate(note.timestamp)}</span>
      </div>

      <p className="text-slate-200 leading-relaxed mb-4 whitespace-pre-wrap">{note.content}</p>

      {note.forwardedToCalendar && (
        <div className="flex items-center gap-2 text-[11px] text-cyan-400 bg-cyan-900/20 px-3 py-2 rounded-lg border border-cyan-800/30">
          <i className="fa-solid fa-calendar-check"></i>
          <span>Synced to Calendar</span>
          {note.metadata?.detectedTime && (
             <span className="ml-auto opacity-70 italic">{note.metadata.detectedTime}</span>
          )}
        </div>
      )}
    </div>
  );
};
