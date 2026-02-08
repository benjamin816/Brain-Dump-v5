"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, Category, TrashedNote, ViewType } from '@/types';
import { NoteCard } from '@/components/NoteCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import pkg from '@/package.json';

const TRASH_STORAGE_KEY = 'braindump_trash_v1';
const PURGE_DAYS = 7;

const DEFAULT_CATEGORIES = [
  'personal', 'work', 'creative', 'social', 'health', 
  'money', 'food', 'home', 'travel', 'learning', 
  'admin', 'wishlist', 'other'
];

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<TrashedNote[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('inbox');
  const [inputValue, setInputValue] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(Category.ALL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingCats, setIsLoadingCats] = useState(true);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCatInput, setNewCatInput] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchCategories = useCallback(async () => {
    setIsLoadingCats(true);
    try {
      const res = await fetch('/api/config/categories');
      const data = await res.json();
      if (data.ok && Array.isArray(data.categories)) {
        setCustomCategories(data.categories);
        localStorage.setItem('braindump_categories_v1', JSON.stringify(data.categories));
      }
    } catch (e) {} finally { setIsLoadingCats(false); }
  }, []);

  useEffect(() => {
    const savedTrash = localStorage.getItem(TRASH_STORAGE_KEY);
    if (savedTrash) {
      try {
        const parsed: TrashedNote[] = JSON.parse(savedTrash);
        const now = Date.now();
        const freshTrash = parsed.filter(item => (now - new Date(item.deletedAt).getTime()) < PURGE_DAYS * 24 * 60 * 60 * 1000);
        setTrash(freshTrash);
      } catch (e) {}
    }
    const cachedCats = localStorage.getItem('braindump_categories_v1');
    if (cachedCats) {
      try { setCustomCategories(JSON.parse(cachedCats)); } catch (e) {}
    }
    fetchCategories();
  }, [fetchCategories]);

  const fetchNotes = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await fetch('/api/entries');
      const data = await res.json();
      if (data.ok && Array.isArray(data.entries)) {
        setNotes(data.entries);
        setLastSynced(new Date());
      }
    } catch (e) {
      setStatus({ message: "Cloud Sync Unavailable", type: 'error' }); 
    } finally { if (!isSilent) setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(() => { 
      if (currentView === 'inbox' && !editingId && !isProcessing) fetchNotes(true); 
    }, 30000); 
    return () => clearInterval(interval);
  }, [fetchNotes, currentView, editingId, isProcessing]);

  const processNewNote = async (textToProcess?: string) => {
    const text = textToProcess || inputValue;
    if (!text.trim() || isProcessing) return false;
    setIsProcessing(true);
    setStatus({ message: "Neuralizing Thought...", type: 'info' });
    try {
      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, created_at: new Date().toISOString() }),
      });
      const result = await response.json();
      if (result.ok) {
        if (!textToProcess) setInputValue('');
        setStatus({ message: result.calendar_routed ? "Routed to Calendar & Logged" : "Thought Captured", type: 'success' });
        await fetchNotes();
        setTimeout(() => setStatus(null), 3000);
        return true;
      }
    } catch (error: any) {
      setStatus({ message: error.message || "Sync failed", type: 'error' });
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
      const newTrash = trash.filter(t => t.trashId !== (note as TrashedNote).trashId);
      setTrash(newTrash);
      localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
      return;
    }
    if (!confirm('Move to Trash?')) return;
    try {
      const res = await fetch(`/api/entries/${note.id}`, { method: 'DELETE' });
      if (res.ok) {
        const deleted = { ...note, deletedAt: new Date().toISOString(), trashId: crypto.randomUUID() };
        const newTrash = [deleted, ...trash];
        setTrash(newTrash);
        localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
        setNotes(prev => prev.filter(n => n.id !== note.id));
      }
    } catch (e) { setStatus({ message: "Delete failed", type: 'error' }); }
  };

  const handleRestore = async (trashedNote: TrashedNote) => {
    if (await processNewNote(trashedNote.text)) {
      const newTrash = trash.filter(t => t.trashId !== trashedNote.trashId);
      setTrash(newTrash);
      localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
    }
  };

  // Visibility logic: Show everything in the inbox
  const visibleNotes = useMemo(() => {
    return currentView === 'trash' ? trash : notes;
  }, [notes, trash, currentView]);

  const categoryCounts = useMemo(() => {
    const counts: any = { [Category.ALL]: visibleNotes.length };
    customCategories.forEach(cat => {
      counts[cat] = visibleNotes.filter(n => n.category === cat).length;
    });
    return counts;
  }, [visibleNotes, customCategories]);

  const filteredNotes = useMemo(() => {
    return activeCategory === Category.ALL 
      ? visibleNotes 
      : visibleNotes.filter(n => n.category === activeCategory);
  }, [visibleNotes, activeCategory]);

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-12 md:py-20 relative">
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b_0%,#0f172a_50%)]" />

      <header className="mb-12 text-center animate-fade-in relative">
        <div className="absolute top-0 right-0">
          <button onClick={() => setCurrentView(currentView === 'settings' ? 'inbox' : 'settings')} className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${currentView === 'settings' ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}>
            <i className={`fa-solid ${currentView === 'settings' ? 'fa-xmark' : 'fa-gear'}`}></i>
          </button>
        </div>
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-6">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Intelligence Layer v{pkg.version.split('.')[0]}</span>
        </div>
        <h1 className="text-6xl font-black tracking-tighter mb-4 bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">Brain Dump</h1>
        <div className="flex items-center justify-center gap-4 text-slate-500 font-mono text-[10px] uppercase tracking-widest">
           <span>{lastSynced ? `Synced ${lastSynced.toLocaleTimeString()}` : 'Initializing Neural Link...'}</span>
           <button onClick={() => fetchNotes()} className="hover:text-white transition-colors"><i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i></button>
        </div>
      </header>

      {currentView === 'settings' ? (
        <section className="animate-fade-in max-w-3xl mx-auto mb-32">
          <div className="glass rounded-[3.5rem] p-12 border-white/10">
            <h2 className="text-4xl font-black text-white mb-12">Settings</h2>
            <div className="space-y-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">Manage Categories</h3>
              <div className="flex gap-4">
                <input type="text" value={newCatInput} onChange={(e) => setNewCatInput(e.target.value)} placeholder="New category..." className="flex-1 bg-slate-900 border border-white/5 rounded-2xl px-6 py-4 text-white" />
                <button onClick={() => { if(newCatInput.trim()) setCustomCategories([...customCategories, newCatInput.trim()]); setNewCatInput(''); }} className="bg-white text-black px-8 rounded-2xl font-black uppercase tracking-widest">Add</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {customCategories.map(cat => (
                  <div key={cat} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                    <span className="capitalize">{cat}</span>
                    <button onClick={() => setCustomCategories(customCategories.filter(c => c !== cat))} className="text-rose-500"><i className="fa-solid fa-trash-can"></i></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setCurrentView('inbox')} className="w-full bg-slate-800 py-6 rounded-3xl font-black uppercase tracking-widest mt-12">Return</button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {currentView === 'inbox' && (
            <section className="mb-16 max-w-3xl mx-auto animate-fade-in">
              <div className="glass p-2 rounded-[3.5rem] border-white/5 shadow-2xl">
                <textarea value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); processNewNote(); } }} placeholder="Capture thought..." className="w-full bg-transparent border-none text-2xl p-8 min-h-[180px] text-white resize-none" disabled={isProcessing} />
                <div className="flex items-center justify-between px-8 pb-6 pt-2">
                  <div className="flex-1">
                    {status && <span className="text-[10px] font-black uppercase text-slate-300">{status.message}</span>}
                  </div>
                  <button onClick={() => processNewNote()} disabled={isProcessing || !inputValue.trim()} className="bg-white text-slate-900 px-12 py-5 rounded-[2rem] font-black uppercase tracking-widest shadow-2xl">Capture</button>
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-col items-center mb-12 gap-6">
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-[1.8rem] border border-white/5">
              <button onClick={() => setCurrentView('inbox')} className={`px-10 py-3 rounded-[1.3rem] text-[9px] font-black uppercase transition-all ${currentView === 'inbox' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Inbox</button>
              <button onClick={() => setCurrentView('trash')} className={`px-10 py-3 rounded-[1.3rem] text-[9px] font-black uppercase transition-all ${currentView === 'trash' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}>Archive</button>
            </div>
            <CategoryFilter activeCategory={activeCategory} categories={customCategories} onSelectCategory={setActiveCategory} counts={categoryCounts} />
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-8 mb-24">
            {isLoading && notes.length === 0 ? (
              <div className="col-span-full py-32 text-center"><p className="text-[10px] font-black uppercase text-slate-500">Syncing...</p></div>
            ) : filteredNotes.length > 0 ? (
              filteredNotes.map(note => (
                <NoteCard key={currentView === 'trash' ? (note as TrashedNote).trashId : note.id} note={note} isTrashView={currentView === 'trash'} onDelete={handleDelete} onRestore={handleRestore} onEdit={startEditing} isEditing={editingId === note.id} />
              ))
            ) : (
              <div className="col-span-full py-40 text-center glass rounded-[4rem] flex flex-col items-center justify-center">
                <h3 className="text-xl font-black text-slate-300 mb-2">No Signals</h3>
              </div>
            )}
          </section>
        </>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/95 backdrop-blur-md p-6">
          <div className="glass w-full max-w-2xl p-12 rounded-[4rem]">
            <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-3xl p-8 text-xl text-white min-h-[250px] mb-10" />
            <div className="flex flex-wrap gap-2 mb-12">
              {customCategories.map(cat => (
                <button key={cat} onClick={() => setEditCategory(cat)} className={`px-5 py-2.5 rounded-xl text-[9px] font-black uppercase border transition-all ${editCategory === cat ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-slate-900 text-slate-500'}`}>{cat}</button>
              ))}
            </div>
            <div className="flex gap-4">
              <button onClick={() => updateNote(editingId)} className="flex-[2] bg-white text-slate-900 py-6 rounded-[2rem] font-black uppercase tracking-widest">Update</button>
              <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-800 text-white py-6 rounded-[2rem] font-black uppercase tracking-widest">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}