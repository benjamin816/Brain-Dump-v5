"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, Category, TrashedNote, ViewType } from '@/types';
import { NoteCard } from '@/components/NoteCard';
import { CategoryFilter } from '@/components/CategoryFilter';

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

  useEffect(() => {
    const savedTrash = localStorage.getItem(TRASH_STORAGE_KEY);
    if (savedTrash) {
      try {
        const parsed: TrashedNote[] = JSON.parse(savedTrash);
        const now = Date.now();
        const freshTrash = parsed.filter(item => {
          const ageInMs = now - new Date(item.deletedAt).getTime();
          return ageInMs < PURGE_DAYS * 24 * 60 * 60 * 1000;
        });
        setTrash(freshTrash);
        if (freshTrash.length !== parsed.length) localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(freshTrash));
      } catch (e) { console.error("Trash restoration error", e); }
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
        setNotes(data.entries.sort((a: any, b: any) => 
          new Date(b.created_at_server).getTime() - new Date(a.created_at_server).getTime()
        ));
      }
    } catch (e) { setStatus({ message: "Sync failed", type: 'error' }); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(() => { if (currentView === 'inbox' && !editingId) fetchNotes(); }, 60000); 
    return () => clearInterval(interval);
  }, [fetchNotes, currentView, editingId]);

  const processNewNote = async (textToProcess?: string) => {
    const text = textToProcess || inputValue;
    if (!text.trim() || isProcessing) return false;
    
    setIsProcessing(true);
    setStatus({ message: "Intelligizing...", type: 'info' });
    
    try {
      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, created_at: new Date().toISOString() }),
      });

      const result = await response.json();
      if (result.ok) {
        if (!textToProcess) setInputValue('');
        setStatus({ message: result.calendar_routed ? "Routed to Calendar" : "Thought Saved", type: 'success' });
        await fetchNotes();
        setTimeout(() => setStatus(null), 3000);
        return true;
      } else throw new Error(result.error);
    } catch (error: any) {
      setStatus({ message: error.message || "Sync failed", type: 'error' });
      return false;
    } finally { setIsProcessing(false); }
  };

  const startEditing = (note: Note) => {
    setEditingId(note.id);
    setEditValue(note.text);
    setEditCategory(note.category as string);
  };

  const updateNote = async (id: string) => {
    if (!id || isUpdating) return;
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editValue, category: editCategory })
      });
      if ((await res.json()).ok) {
        setEditingId(null);
        await fetchNotes();
      }
    } catch (e) { setStatus({ message: "Update failed", type: 'error' }); }
    finally { setIsUpdating(false); }
  };

  const handleDelete = async (note: Note) => {
    if (currentView === 'trash') {
      if (!confirm('Permanently delete?')) return;
      saveTrashToLocal(trash.filter(t => t.trashId !== (note as TrashedNote).trashId));
      return;
    }

    if (!confirm('Move to Trash?')) return;
    try {
      const res = await fetch(`/api/entries/${note.id}`, { method: 'DELETE' });
      if (res.ok) {
        saveTrashToLocal([{ ...note, deletedAt: new Date().toISOString(), trashId: crypto.randomUUID() }, ...trash]);
        setNotes(prev => prev.filter(n => n.id !== note.id));
      }
    } catch (e) { setStatus({ message: "Delete failed", type: 'error' }); }
  };

  const handleRestore = async (trashedNote: TrashedNote) => {
    if (await processNewNote(trashedNote.text)) {
      saveTrashToLocal(trash.filter(t => t.trashId !== trashedNote.trashId));
    }
  };

  const categoryCounts = useMemo(() => {
    const list = currentView === 'trash' ? trash : notes;
    const counts: any = { [Category.ALL]: list.length };
    Object.values(Category).forEach(cat => {
      if (cat !== Category.ALL) counts[cat] = list.filter(n => n.category === cat).length;
    });
    return counts;
  }, [notes, trash, currentView]);

  const filteredNotes = useMemo(() => {
    const list = currentView === 'trash' ? trash : notes;
    return activeCategory === Category.ALL ? list : list.filter(n => n.category === activeCategory);
  }, [notes, trash, activeCategory, currentView]);

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-12 md:py-24 relative">
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b_0%,#0f172a_50%)]" />

      <header className="mb-16 text-center">
        <h1 className="text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">Brain Dump</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">Neural Sync Intelligence Layer</p>
      </header>

      {currentView === 'inbox' && (
        <section className="mb-20 max-w-3xl mx-auto">
          <div className="glass p-4 rounded-[3rem] border-white/5 shadow-2xl focus-within:ring-2 ring-indigo-500/20 transition-all">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); processNewNote(); } }}
              placeholder="Dump your consciousness..."
              className="w-full bg-transparent border-none focus:ring-0 text-2xl p-6 min-h-[160px] text-white placeholder:text-slate-700 font-medium resize-none"
              disabled={isProcessing}
            />
            <div className="flex items-center justify-between px-6 pb-4">
              <div className="flex-1">
                {status && (
                  <div className="flex items-center gap-3 animate-fade-in">
                    <div className={`w-2 h-2 rounded-full ${status.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500'} animate-pulse shadow-lg`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{status.message}</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => processNewNote()}
                disabled={isProcessing || !inputValue.trim()}
                className="bg-white text-slate-900 px-10 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-20"
              >
                {isProcessing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <span>Capture Thought</span>}
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="flex items-center justify-center gap-4 mb-12 bg-slate-900/50 p-2 rounded-2xl border border-white/5 w-fit mx-auto backdrop-blur-xl">
        <button onClick={() => setCurrentView('inbox')} className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentView === 'inbox' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-white'}`}>
          <i className="fa-solid fa-brain mr-2"></i> Inbox ({notes.length})
        </button>
        <button onClick={() => setCurrentView('trash')} className={`px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${currentView === 'trash' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-white'}`}>
          <i className="fa-solid fa-trash mr-2"></i> Trash ({trash.length})
        </button>
      </div>

      <CategoryFilter activeCategory={activeCategory} onSelectCategory={setActiveCategory} counts={categoryCounts} />

      <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
        {isLoading && notes.length === 0 ? (
          <div className="col-span-full py-20 text-center"><i className="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-500/50"></i></div>
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map(note => (
            <NoteCard 
              key={currentView === 'trash' ? (note as TrashedNote).trashId : note.id} 
              note={note} 
              isTrashView={currentView === 'trash'} 
              onDelete={handleDelete}
              onRestore={handleRestore}
              onEdit={startEditing}
              isEditing={editingId === note.id}
            />
          ))
        ) : (
          <div className="col-span-full py-40 text-center glass rounded-[4rem] border-dashed border-white/10 flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-800/50 rounded-[2rem] flex items-center justify-center mb-6"><i className="fa-solid fa-ghost text-3xl text-slate-600"></i></div>
            <h3 className="text-xl font-bold text-slate-300">Quiet in the headspace</h3>
          </div>
        )}
      </section>

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
          <div className="glass w-full max-w-2xl p-10 rounded-[3rem] border-white/10 shadow-3xl animate-fade-in">
            <h2 className="text-xl font-black uppercase tracking-widest text-indigo-400 mb-8">Refine Neural Entry</h2>
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/5 rounded-2xl p-6 text-xl text-white min-h-[200px] mb-8 focus:ring-0"
            />
            <div className="flex flex-wrap gap-4 mb-8">
              {Object.values(Category).filter(c => c !== Category.ALL).map(cat => (
                <button
                  key={cat}
                  onClick={() => setEditCategory(cat)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${editCategory === cat ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-slate-900 border-white/5 text-slate-500'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => updateNote(editingId)} className="flex-1 bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all">Save Changes</button>
              <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-800 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
