"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, Category, TrashedNote, ViewType } from '@/types';

const TRASH_STORAGE_KEY = 'braindump_trash_v1';
const PURGE_DAYS = 7;

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<TrashedNote[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('inbox');
  const [inputValue, setInputValue] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>(Category.ALL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Initialize Trash and Purge old items
  useEffect(() => {
    const savedTrash = localStorage.getItem(TRASH_STORAGE_KEY);
    if (savedTrash) {
      try {
        const parsed: TrashedNote[] = JSON.parse(savedTrash);
        const now = Date.now();
        const freshTrash = parsed.filter(item => {
          const deletedAt = new Date(item.deletedAt).getTime();
          const ageInMs = now - deletedAt;
          return ageInMs < PURGE_DAYS * 24 * 60 * 60 * 1000;
        });
        setTrash(freshTrash);
        if (freshTrash.length !== parsed.length) {
          localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(freshTrash));
        }
      } catch (e) {
        console.error("Trash restoration error", e);
      }
    }
  }, []);

  const saveTrashToLocal = (newTrash: TrashedNote[]) => {
    setTrash(newTrash);
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
  };

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/entries');
      const data = await res.json();
      
      if (data.ok && Array.isArray(data.entries)) {
        const mapped: Note[] = data.entries.map((item: any) => ({
          id: item.id || item.uuid,
          text: item.text || item.content,
          created_at_client: item.created_at_client || item.created_at,
          created_at_server: item.created_at_server || item.received_at,
          item_type: item.item_type,
          time_bucket: item.time_bucket,
          category: item.category || item.categories,
          source: item.source || item.status
        }));

        const sorted = mapped.sort((a, b) => {
          const timeA = new Date(a.created_at_server || a.created_at_client || 0).getTime();
          const timeB = new Date(b.created_at_server || b.created_at_client || 0).getTime();
          return timeB - timeA;
        });
        setNotes(sorted);
      }
    } catch (e) {
      console.error("Fetch Error:", e);
      setStatus({ message: "Sync failed", type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(() => {
      if (currentView === 'inbox' && !editingId) fetchNotes();
    }, 60000); 
    return () => clearInterval(interval);
  }, [fetchNotes, currentView, editingId]);

  const processNewNote = async (textToProcess?: string) => {
    const text = textToProcess || inputValue;
    if (!text.trim() || isProcessing) return false;
    
    setIsProcessing(true);
    if (!textToProcess) setStatus({ message: "AI Processing...", type: 'info' });
    
    try {
      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: text,
          created_at: new Date().toISOString() 
        }),
      });

      const result = await response.json();
      if (result.ok) {
        if (!textToProcess) setInputValue('');
        setStatus({ 
          message: result.calendar_routed ? "Captured & Routed to Calendar" : "Thought Captured", 
          type: 'success' 
        });
        await fetchNotes();
        setTimeout(() => setStatus(null), 3000);
        return true;
      } else {
        throw new Error(result.error || "Communication error");
      }
    } catch (error: any) {
      console.error("Processing Error:", error);
      setStatus({ message: error.message || "Failed to sync", type: 'error' });
      setTimeout(() => setStatus(null), 5000);
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  const startEditing = (note: Note) => {
    setEditingId(note.id);
    setEditValue(note.text);
    setEditCategory(note.category as string);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue('');
    setEditCategory('');
  };

  const updateNote = async (id: string) => {
    if (!id || isUpdating) return;
    setIsUpdating(true);
    setStatus({ message: "Saving changes...", type: 'info' });

    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: editValue,
          category: editCategory
        })
      });

      const result = await res.json();
      if (result.ok) {
        setStatus({ message: "Entry updated", type: 'success' });
        setEditingId(null);
        await fetchNotes();
        setTimeout(() => setStatus(null), 2000);
      } else {
        throw new Error(result.error || "Update failed");
      }
    } catch (error: any) {
      console.error("Update Error:", error);
      setStatus({ message: error.message || "Failed to update", type: 'error' });
      setTimeout(() => setStatus(null), 4000);
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteNote = async (note: Note) => {
    if (!confirm('Move this entry to Trash?')) return;
    
    const id = note.id;
    const trashedItem: TrashedNote = { 
      ...note, 
      deletedAt: new Date().toISOString(),
      trashId: crypto.randomUUID() 
    };

    if (!id || id.startsWith('legacy-')) {
        saveTrashToLocal([trashedItem, ...trash]);
        setNotes(prev => prev.filter(n => n.id !== id && n.text !== note.text));
        return;
    }

    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        saveTrashToLocal([trashedItem, ...trash]);
        setNotes(prev => prev.filter(n => n.id !== id));
        setStatus({ message: "Moved to Trash", type: 'info' });
        setTimeout(() => setStatus(null), 2000);
      } else {
        throw new Error("Server deletion failed");
      }
    } catch (e) {
      console.error("Delete Error:", e);
      setStatus({ message: "Failed to remove entry", type: 'error' });
    }
  };

  const restoreFromTrash = async (trashedNote: TrashedNote) => {
    setStatus({ message: "Restoring entry...", type: 'info' });
    const success = await processNewNote(trashedNote.text);
    if (success) {
      const newTrash = trash.filter(t => t.trashId !== trashedNote.trashId);
      saveTrashToLocal(newTrash);
      setStatus({ message: "Entry restored to Inbox", type: 'success' });
    }
  };

  const permanentlyDeleteFromTrash = (trashedNote: TrashedNote) => {
    if (!confirm('Permanently delete this from Local Storage? This cannot be undone.')) return;
    const newTrash = trash.filter(t => t.trashId !== trashedNote.trashId);
    saveTrashToLocal(newTrash);
  };

  const emptyTrash = () => {
    if (!confirm('Are you sure you want to empty the Trash?')) return;
    saveTrashToLocal([]);
  };

  const filteredNotes = useMemo(() => {
    const list = currentView === 'trash' ? trash : notes;
    const sorted = [...list].sort((a, b) => {
        const timeA = currentView === 'trash' 
            ? new Date((a as TrashedNote).deletedAt).getTime() 
            : new Date(a.created_at_server || a.created_at_client).getTime();
        const timeB = currentView === 'trash' 
            ? new Date((b as TrashedNote).deletedAt).getTime() 
            : new Date(b.created_at_server || b.created_at_client).getTime();
        return timeB - timeA;
    });

    if (activeCategory === Category.ALL) return sorted;
    return sorted.filter(n => (n.category || '').toString().toLowerCase() === activeCategory.toString().toLowerCase());
  }, [notes, trash, activeCategory, currentView]);

  const categories = Object.values(Category);

  const getCategoryStyles = (cat: string = '') => {
    const normalized = cat.toString().trim().toLowerCase();
    switch (normalized) {
      case 'work': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'personal': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case 'creative': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'health': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'finance': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'social': return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
      case 'admin': return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
      default: return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
    }
  };

  const safeFormatDate = (serverDate?: string, clientDate?: string) => {
    const dateStr = serverDate || clientDate;
    if (!dateStr) return 'No Date';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 sm:px-8 py-12 md:py-20 relative font-sans">
      
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-cyan-500/5 blur-[120px] rounded-full" />
      </div>

      {/* Header */}
      <header className="mb-16 text-center animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-400 bg-clip-text text-transparent">
          Brain Dump
        </h1>
        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.4em]">
          Intelligence Layer v5.1 &bull; {currentView === 'inbox' ? 'Active Feed' : 'Storage Vault'}
        </p>
      </header>

      {/* Input Module */}
      {currentView === 'inbox' && (
        <section className="mb-16 max-w-3xl mx-auto animate-fade-in">
            <div className="glass p-3 rounded-[2.5rem] border-white/5 group shadow-2xl transition-all hover:border-white/10 focus-within:border-indigo-500/30">
            <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        processNewNote();
                    }
                }}
                placeholder="Unload a thought..."
                className="w-full bg-transparent border-none focus:ring-0 text-xl md:text-2xl p-6 resize-none min-h-[160px] placeholder:text-slate-700 text-slate-100 transition-all font-medium"
                disabled={isProcessing}
            />
            <div className="flex items-center justify-between px-6 pb-6">
                <div className="flex-1 mr-4">
                {status && (
                    <div className={`flex items-center gap-3 animate-fade-in`}>
                        <div className={`shrink-0 w-2 h-2 rounded-full ${status.type === 'error' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'} animate-pulse`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${
                            status.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
                        }`}>
                            {status.message}
                        </span>
                    </div>
                )}
                </div>
                <button
                onClick={() => processNewNote()}
                disabled={isProcessing || !inputValue.trim()}
                className={`flex items-center gap-3 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
                    isProcessing || !inputValue.trim()
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5"
                    : "bg-white text-slate-900 hover:scale-105 active:scale-95 shadow-xl shadow-white/5"
                }`}
                >
                {isProcessing ? (
                    <>
                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                        <span>Syncing</span>
                    </>
                ) : (
                    <>
                        <span>Capture</span>
                        <i className="fa-solid fa-bolt-lightning text-[8px]"></i>
                    </>
                )}
                </button>
            </div>
            </div>
            <p className="mt-4 text-center text-[9px] text-slate-600 font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded border border-white/5 mx-1">⌘ + Enter</kbd> to dump instantly
            </p>
        </section>
      )}

      {/* Navigation & Controls */}
      <section className="mb-12 space-y-8 animate-fade-in">
        <div className="flex items-center justify-center gap-4 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5 w-fit mx-auto backdrop-blur-md">
            <button 
                onClick={() => { setCurrentView('inbox'); setActiveCategory(Category.ALL); }}
                className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentView === 'inbox' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <i className="fa-solid fa-inbox mr-2.5"></i>
                Inbox ({notes.length})
            </button>
            <button 
                onClick={() => { setCurrentView('trash'); setActiveCategory(Category.ALL); }}
                className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentView === 'trash' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <i className="fa-solid fa-trash-can mr-2.5"></i>
                Trash ({trash.length})
            </button>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-8 border-t border-white/5 pt-8">
            <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-1 max-w-full">
            {categories.map((cat) => (
                <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${
                    activeCategory === cat
                    ? (currentView === 'trash' ? "bg-rose-500/20 border-rose-500 text-rose-300" : "bg-indigo-500/20 border-indigo-500 text-indigo-300") + " shadow-inner"
                    : "bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
                }`}
                >
                {cat}
                </button>
            ))}
            </div>

            {currentView === 'trash' ? (
                <button 
                    onClick={emptyTrash}
                    disabled={trash.length === 0}
                    className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400 transition-colors disabled:opacity-20"
                >
                    <i className="fa-solid fa-dumpster-fire text-sm"></i>
                    <span>Purge Storage</span>
                </button>
            ) : (
                <button 
                    onClick={fetchNotes}
                    className="flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
                >
                    <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i>
                    <span>Sync Feed</span>
                </button>
            )}
        </div>
      </section>

      {/* Content Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {isLoading && notes.length === 0 && currentView === 'inbox' ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass h-56 rounded-[2.5rem] border-dashed border-white/5 animate-pulse bg-white/5"></div>
            ))}
          </>
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div 
              key={currentView === 'trash' ? (note as TrashedNote).trashId : (note.id || `local-${note.created_at_client}`)} 
              className={`glass group p-8 md:p-10 rounded-[2.5rem] border-white/5 relative transition-all animate-fade-in ${
                editingId === note.id ? "ring-2 ring-indigo-500/40 bg-indigo-500/5 shadow-2xl" : "hover:-translate-y-1.5 hover:bg-white/[0.04] hover:shadow-2xl hover:shadow-black/40"
              }`}
            >
              {/* Note Action Toolbar */}
              <div className="absolute top-8 right-8 flex items-center gap-2.5 opacity-0 group-hover:opacity-100 transition-all">
                {currentView === 'trash' ? (
                    <>
                        <button 
                            onClick={() => restoreFromTrash(note as TrashedNote)}
                            className="p-3 text-emerald-400 bg-slate-900/90 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-xl"
                            title="Restore"
                        >
                            <i className="fa-solid fa-rotate-left text-xs"></i>
                        </button>
                        <button 
                            onClick={() => permanentlyDeleteFromTrash(note as TrashedNote)}
                            className="p-3 text-rose-400 bg-slate-900/90 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-xl"
                            title="Delete Permanently"
                        >
                            <i className="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </>
                ) : editingId === note.id ? (
                  <>
                    <button 
                      onClick={() => updateNote(note.id)}
                      disabled={isUpdating}
                      className="p-3 text-emerald-400 bg-slate-900/90 rounded-2xl hover:bg-emerald-500 hover:text-white transition-all shadow-xl"
                    >
                      <i className={`fa-solid ${isUpdating ? 'fa-circle-notch fa-spin' : 'fa-check'} text-xs`}></i>
                    </button>
                    <button 
                      onClick={cancelEditing}
                      disabled={isUpdating}
                      className="p-3 text-slate-400 bg-slate-900/90 rounded-2xl hover:bg-slate-700 hover:text-white transition-all shadow-xl"
                    >
                      <i className="fa-solid fa-xmark text-xs"></i>
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                        onClick={() => startEditing(note)}
                        className="p-3 text-slate-500 bg-slate-900/90 rounded-2xl hover:text-indigo-400 hover:bg-indigo-500/10 transition-all shadow-xl"
                    >
                        <i className="fa-solid fa-pen-nib text-xs"></i>
                    </button>
                    <button 
                      onClick={() => deleteNote(note)}
                      className="p-3 text-slate-500 bg-slate-900/90 rounded-2xl hover:text-rose-500 hover:bg-rose-500/10 transition-all shadow-xl"
                    >
                      <i className="fa-solid fa-trash-can text-xs"></i>
                    </button>
                  </>
                )}
              </div>
              
              <div className="flex flex-wrap items-center gap-3 mb-8">
                {editingId === note.id ? (
                   <select 
                     value={editCategory}
                     onChange={(e) => setEditCategory(e.target.value)}
                     className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border bg-slate-900 text-slate-100 border-indigo-500/40 focus:ring-0 focus:border-indigo-500`}
                   >
                     {categories.filter(c => c !== Category.ALL).map(c => (
                       <option key={c} value={c}>{c}</option>
                     ))}
                   </select>
                ) : (
                  <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border ${getCategoryStyles(note.category as string)} shadow-sm`}>
                    {note.category || 'Other'}
                  </span>
                )}
                
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                  {safeFormatDate(note.created_at_server, note.created_at_client)}
                </span>

                {(note.item_type?.toString().toLowerCase() === 'event' || note.isEvent) && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-2 rounded-xl font-black uppercase tracking-[0.2em] shadow-sm shadow-amber-500/5">
                    <i className="fa-solid fa-calendar-check mr-2"></i> Event
                  </span>
                )}
              </div>

              {/* Text Area */}
              {editingId === note.id ? (
                <textarea
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-900/80 border border-indigo-500/20 rounded-3xl p-6 text-slate-100 text-xl leading-relaxed resize-none min-h-[160px] focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 mb-8 transition-all font-medium"
                />
              ) : (
                <p className="text-slate-100 text-xl leading-relaxed whitespace-pre-wrap mb-10 font-medium">
                  {note.text || 'Empty thought...'}
                </p>
              )}

              {/* Metadata Footer */}
              <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.3em] text-slate-600 pt-6 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-fingerprint text-indigo-500/50"></i>
                  <span>SIG: {note.id ? note.id.toString().split('-')[0] : 'NIL'}</span>
                </div>
                {note.time_bucket && note.time_bucket.toLowerCase() !== 'none' && (
                  <div className="flex items-center gap-2 text-indigo-400">
                    <i className="fa-regular fa-clock"></i>
                    <span>{note.time_bucket}</span>
                  </div>
                )}
                {currentView === 'trash' && (
                    <div className="ml-auto text-rose-500/70 flex items-center gap-2">
                        <i className="fa-solid fa-hourglass-half"></i>
                        <span>Auto-Purge in {Math.max(0, Math.ceil((PURGE_DAYS * 24 * 60 * 60 * 1000 - (Date.now() - new Date((note as TrashedNote).deletedAt).getTime())) / (24 * 60 * 60 * 1000)))}d</span>
                    </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-40 text-center glass rounded-[4rem] border-dashed border-white/10 flex flex-col items-center justify-center animate-fade-in">
            <div className={`w-24 h-24 ${currentView === 'trash' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-800/50 text-slate-500'} rounded-[2.5rem] flex items-center justify-center mb-8 shadow-2xl`}>
              <i className={`fa-solid ${currentView === 'trash' ? 'fa-dumpster' : 'fa-brain'} text-4xl`}></i>
            </div>
            <h3 className="text-slate-200 text-2xl font-bold mb-2">
                {currentView === 'trash' ? 'Storage Vault Empty' : 'Mind Clear'}
            </h3>
            <p className="text-slate-600 text-[11px] font-black uppercase tracking-[0.4em]">
                {currentView === 'trash' ? 'No entries queued for deletion' : 'Awaiting your next cognitive export'}
            </p>
          </div>
        )}
      </section>

      {/* Footer Status Bar */}
      <footer className="mt-40 pb-20 flex flex-col items-center gap-6 animate-fade-in">
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="inline-flex items-center gap-4 px-8 py-3 rounded-full border border-white/5 bg-slate-900/50 backdrop-blur-xl">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          <span className="text-[10px] text-slate-500 uppercase font-black tracking-[0.4em]">
            Neural Network: Online &bull; Cloud Sync: Active
          </span>
        </div>
      </footer>
    </main>
  );
}
