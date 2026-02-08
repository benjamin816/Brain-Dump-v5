import React, { useState } from 'react';
import { Note, Category, ItemType, TrashedNote } from '../types';

interface NoteCardProps {
  note: Note | TrashedNote;
  isTrashView?: boolean;
  onDelete: (note: any) => void;
  onRestore?: (note: any) => void;
  onEdit?: (note: any) => void;
  isEditing?: boolean;
}

export const NoteCard: React.FC<NoteCardProps> = ({ 
  note, 
  isTrashView, 
  onDelete, 
  onRestore, 
  onEdit,
  isEditing 
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(note.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (serverDate?: string, clientDate?: string) => {
    const dateStr = serverDate || clientDate;
    if (!dateStr) return 'No date';
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getCategoryStyles = (cat: string = '') => {
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

  const isEvent = (note.item_type?.toString().toLowerCase() === 'event' || note.isEvent);
  const isForwarded = note.status === 'FORWARDED';

  return (
    <div className={`glass group relative p-8 rounded-[2.5rem] border-white/5 transition-all animate-fade-in ${
      isEditing ? "ring-2 ring-indigo-500/40 bg-indigo-500/5" : "hover:bg-white/[0.04] hover:-translate-y-1 hover:shadow-2xl"
    }`}>
      
      {/* Actions */}
      <div className="absolute top-8 right-8 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isTrashView && (
          <button 
            onClick={handleCopy}
            className={`p-2.5 rounded-xl bg-slate-900 border border-white/10 transition-all ${copied ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}
            title="Copy Text"
          >
            <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'} text-xs`}></i>
          </button>
        )}
        {!isTrashView && onEdit && (
          <button 
            onClick={() => onEdit(note)}
            className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-indigo-400 transition-all"
            title="Edit Entry"
          >
            <i className="fa-solid fa-pen-nib text-xs"></i>
          </button>
        )}
        {isTrashView && onRestore && (
          <button 
            onClick={() => onRestore(note)}
            className="p-2.5 rounded-xl bg-slate-900 border border-white/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all"
            title="Restore"
          >
            <i className="fa-solid fa-rotate-left text-xs"></i>
          </button>
        )}
        <button 
          onClick={() => onDelete(note)}
          className={`p-2.5 rounded-xl bg-slate-900 border border-white/10 transition-all ${isTrashView ? 'text-rose-400 hover:bg-rose-500' : 'text-slate-400 hover:text-rose-500'} hover:text-white`}
          title={isTrashView ? "Delete Permanently" : "Move to Trash"}
        >
          <i className={`fa-solid ${isTrashView ? 'fa-xmark' : 'fa-trash-can'} text-xs`}></i>
        </button>
      </div>

      {/* Header Info */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${getCategoryStyles(note.category as string)}`}>
          <i className={`fa-solid ${getTypeIcon(note.item_type as string)} text-xs`}></i>
        </div>
        <span className={`text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg border ${getCategoryStyles(note.category as string)}`}>
          {note.category || 'Other'}
        </span>
        <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-1 rounded">
          {formatDate(note.created_at_server, note.created_at_client)}
        </span>
        {isForwarded && (
          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded font-black uppercase tracking-tighter">
            <i className="fa-solid fa-calendar-check mr-1.5"></i> Synced
          </span>
        )}
        {isEvent && !isForwarded && (
          <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-1 rounded font-black uppercase tracking-tighter">
            <i className="fa-solid fa-calendar mr-1.5"></i> Event
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-slate-100 text-lg leading-relaxed font-medium mb-8 whitespace-pre-wrap">
        {note.text}
      </p>

      {/* Footer Meta */}
      <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-widest text-slate-600 pt-6 border-t border-white/5">
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-fingerprint text-indigo-500/30"></i>
          <span>{note.id ? note.id.split('-')[0] : 'LOCAL'}</span>
        </div>
        {note.time_bucket && note.time_bucket.toLowerCase() !== 'none' && (
          <div className="flex items-center gap-2 text-indigo-400/70">
            <i className="fa-regular fa-clock"></i>
            <span>{note.time_bucket}</span>
          </div>
        )}
        {isTrashView && (note as TrashedNote).deletedAt && (
           <div className="ml-auto text-rose-500/50 flex items-center gap-2">
             <i className="fa-solid fa-hourglass-end"></i>
             <span>Queued for Purge</span>
           </div>
        )}
      </div>
    </div>
  );
};
