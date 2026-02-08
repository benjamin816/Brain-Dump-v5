"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Note, Category, TrashedNote, ViewType } from '@/types';
import { NoteCard } from '@/components/NoteCard';
import { CategoryFilter } from '@/components/CategoryFilter';
import pkg from '@/package.json';

const TRASH_STORAGE_KEY = 'braindump_trash_v1';
const CATEGORIES_STORAGE_KEY = 'braindump_categories_v1';
const PURGE_DAYS = 7;

const DEFAULT_CATEGORIES = [
  'Work', 'Personal', 'Creative', 'Health', 'Finance', 'Admin', 'Social', 'Other'
];

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [trash, setTrash] = useState<TrashedNote[]>([]);
  const [currentView, setCurrentView] = useState<ViewType>('inbox');
  const [inputValue, setInputValue] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>(Category.ALL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  // Dynamic Categories
  const [customCategories, setCustomCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [newCatInput, setNewCatInput] = useState('');

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editCategory, setEditCategory] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Load Trash and Categories
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

    const savedCats = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (savedCats) {
      try {
        setCustomCategories(JSON.parse(savedCats));
      } catch (e) { console.error("Category restoration error", e); }
    }
  }, []);

  const saveCategories = (cats: string[]) => {
    setCustomCategories(cats);
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(cats));
  };

  const addCategory = () => {
    const trimmed = newCatInput.trim();
    if (trimmed && !customCategories.includes(trimmed)) {
      saveCategories([...customCategories, trimmed]);
      setNewCatInput('');
    }
  };

  const removeCategory = (cat: string) => {
    if (confirm(`Delete category "${cat}"? This won't delete notes in this category.`)) {
      saveCategories(customCategories.filter(c => c !== cat));
      if (activeCategory === cat) setActiveCategory(Category.ALL);
    }
  };

  const saveTrashToLocal = (newTrash: TrashedNote[]) => {
    setTrash(newTrash);
    localStorage.setItem(TRASH_STORAGE_KEY, JSON.stringify(newTrash));
  };

  const fetchNotes = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await fetch('/api/entries');
      const data = await res.json();
      if (data.ok && Array.isArray(data.entries)) {
        setNotes(data.entries);
        setLastSynced(new Date());
      } else {
        throw new Error(data.error || "Failed to parse entries");
      }
    } catch (e: any) { 
      console.error("Fetch error:", e);
      setStatus({ message: "Cloud Sync Unavailable", type: 'error' }); 
    }
    finally { if (!isSilent) setIsLoading(false); }
  }, []);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(() => { 
      if (currentView === 'inbox' && !editingId && !isProcessing) {
        fetchNotes(true); 
      }
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
        body: JSON.stringify({ 
          text, 
          created_at: new Date().toISOString(),
          categories: customCategories 
        }),
      });

      const result = await response.json();
      if (result.ok) {
        if (!textToProcess) setInputValue('');
        setStatus({ message: result.calendar_routed ? "Routed to Calendar & Logged" : "Thought Captured", type: 'success' });
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
    customCategories.forEach(cat => {
      counts[cat] = list.filter(n => n.category === cat).length;
    });
    return counts;
  }, [notes, trash, currentView, customCategories]);

  const filteredNotes = useMemo(() => {
    const list = currentView === 'trash' ? trash : notes;
    return activeCategory === Category.ALL ? list : list.filter(n => n.category === activeCategory);
  }, [notes, trash, activeCategory, currentView]);

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-12 md:py-24 relative">
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[radial-gradient(circle_at_50%_0%,#1e1b4b_0%,#0f172a_50%)]" />

      <header className="mb-16 text-center animate-fade-in relative">
        <div className="absolute top-0 right-0">
          <button 
            onClick={() => setCurrentView(currentView === 'settings' ? 'inbox' : 'settings')}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all ${currentView === 'settings' ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
          >
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
           <button onClick={() => fetchNotes()} className="hover:text-white transition-colors">
             <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
           </button>
        </div>
      </header>

      {currentView === 'settings' ? (
        <section className="animate-fade-in max-w-3xl mx-auto mb-32">
          <div className="glass rounded-[3.5rem] p-12 border-white/10 shadow-3xl">
            <div className="flex items-center gap-6 mb-12">
               <div className="w-16 h-16 rounded-[2rem] bg-indigo-500 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
                 <i className="fa-solid fa-sliders text-2xl text-white"></i>
               </div>
               <div>
                 <h2 className="text-4xl font-black tracking-tight text-white leading-none">Settings</h2>
                 <p className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mt-2">Adjust your intelligence parameters</p>
               </div>
            </div>

            <div className="space-y-12">
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-3">
                  <i className="fa-solid fa-tags text-indigo-500"></i> Manage Categories
                </h3>
                
                <div className="flex gap-4 mb-8">
                  <input 
                    type="text" 
                    value={newCatInput}
                    onChange={(e) => setNewCatInput(e.target.value)}
                    placeholder="Add new category..."
                    className="flex-1 bg-slate-900/50 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-slate-700 outline-none focus:ring-2 ring-indigo-500/40 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                  />
                  <button 
                    onClick={addCategory}
                    className="bg-white text-slate-900 px-8 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl"
                  >
                    Add
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {customCategories.map(cat => (
                    <div key={cat} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                      <span className="text-sm font-bold text-slate-200">{cat}</span>
                      <button 
                        onClick={() => removeCategory(cat)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                      >
                        <i className="fa-solid fa-trash-can text-xs"></i>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-12 border-t border-white/5">
                <button 
                  onClick={() => setCurrentView('inbox')}
                  className="w-full bg-slate-800 text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all"
                >
                  Return to Inbox
                </button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <>
          {currentView === 'inbox' && (
            <section className="mb-20 max-w-3xl mx-auto animate-fade-in">
              <div className="glass p-2 rounded-[3.5rem] border-white/5 shadow-2xl focus-within:ring-2 ring-indigo-500/40 transition-all">
                <div className="relative">
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); processNewNote(); } }}
                    placeholder="What's on your mind? Webhooks will appear here automatically..."
                    className="w-full bg-transparent border-none focus:ring-0 text-2xl p-8 min-h-[180px] text-white placeholder:text-slate-700 font-medium resize-none"
                    disabled={isProcessing}
                  />
                  <div className="absolute top-8 right-8 text-slate-800 text-xs font-mono select-none pointer-events-none">
                    ⌘ + Enter to capture
                  </div>
                </div>
                
                <div className="flex items-center justify-between px-8 pb-6 pt-2">
                  <div className="flex-1">
                    {status ? (
                      <div className="flex items-center gap-3 animate-fade-in">
                        <div className={`w-2 h-2 rounded-full ${status.type === 'error' ? 'bg-rose-500' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'} animate-pulse`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">{status.message}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 opacity-40">
                        <i className="fa-solid fa-bolt-lightning text-amber-500 text-xs"></i>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Auto-Categorization Enabled</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => processNewNote()}
                    disabled={isProcessing || !inputValue.trim()}
                    className="relative overflow-hidden group bg-white text-slate-900 px-12 py-5 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl disabled:opacity-20 disabled:scale-100"
                  >
                    <span className="relative z-10">{isProcessing ? <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> : null} Capture Thought</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                  </button>
                </div>
              </div>
            </section>
          )}

          <div className="flex flex-col items-center mb-16 gap-8">
            <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-[2rem] border border-white/5 backdrop-blur-3xl shadow-2xl">
              <button onClick={() => setCurrentView('inbox')} className={`px-12 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${currentView === 'inbox' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                <i className="fa-solid fa-brain mr-2"></i> Neural Inbox
              </button>
              <button onClick={() => setCurrentView('trash')} className={`px-12 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${currentView === 'trash' ? 'bg-rose-600 text-white shadow-xl shadow-rose-600/30' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}>
                <i className="fa-solid fa-trash-can mr-2"></i> Archive
              </button>
            </div>
            
            <CategoryFilter 
              activeCategory={activeCategory} 
              categories={customCategories}
              onSelectCategory={setActiveCategory} 
              counts={categoryCounts} 
            />
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-12 mb-32">
            {isLoading && notes.length === 0 ? (
              <div className="col-span-full py-40 text-center flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i className="fa-solid fa-brain text-indigo-500/50"></i>
                  </div>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Syncing with Google Cloud Persistence...</p>
              </div>
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
              <div className="col-span-full py-48 text-center glass rounded-[4rem] border-dashed border-white/10 flex flex-col items-center justify-center animate-fade-in group">
                <div className="w-24 h-24 bg-slate-800/50 rounded-[2.5rem] flex items-center justify-center mb-8 border border-white/5 group-hover:scale-110 transition-transform duration-500 shadow-2xl">
                  <i className="fa-solid fa-ghost text-4xl text-slate-600 group-hover:text-indigo-500/50 transition-colors"></i>
                </div>
                <h3 className="text-2xl font-black text-slate-300 mb-2">Null Headspace Detected</h3>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-600">No signals found in the {activeCategory === Category.ALL ? 'active frequency' : `${activeCategory} spectrum`}</p>
              </div>
            )}
          </section>

          {/* Siri Shortcut Info Section */}
          <footer className="max-w-2xl mx-auto py-12 border-t border-white/5 text-center">
            <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-500/50 mb-8">External Uplink Configuration</h4>
            <div className="flex flex-wrap justify-center gap-12 text-slate-500">
               <div className="flex flex-col items-center gap-3">
                 <i className="fa-solid fa-link text-xl text-slate-700"></i>
                 <div className="text-[9px] font-black uppercase tracking-widest">Webhook Endpoint</div>
                 <code className="bg-black/40 px-3 py-1.5 rounded border border-white/5 text-[10px] text-emerald-500">/api/inbox</code>
               </div>
               <div className="flex flex-col items-center gap-3">
                 <i className="fa-solid fa-microphone text-xl text-slate-700"></i>
                 <div className="text-[9px] font-black uppercase tracking-widest">Siri Shortcut</div>
                 <div className="text-[10px] text-slate-400">POST plain text to URL</div>
               </div>
            </div>
          </footer>
        </>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a]/95 backdrop-blur-md p-6">
          <div className="glass w-full max-w-2xl p-12 rounded-[4rem] border-white/10 shadow-3xl animate-fade-in">
            <div className="flex items-center gap-4 mb-10">
               <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                 <i className="fa-solid fa-pen-nib text-white"></i>
               </div>
               <div>
                 <h2 className="text-2xl font-black tracking-tight text-white leading-none">Edit Thought</h2>
                 <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mt-1">Refining persistence layer</p>
               </div>
            </div>

            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/10 rounded-3xl p-8 text-xl text-white min-h-[250px] mb-10 focus:ring-2 ring-indigo-500/30 transition-all outline-none"
            />
            
            <div className="flex flex-wrap gap-3 mb-12">
              {customCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setEditCategory(cat)}
                  className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${editCategory === cat ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <button onClick={() => updateNote(editingId)} className="flex-[2] bg-white text-slate-900 py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-2xl">
                Update Signal
              </button>
              <button onClick={() => setEditingId(null)} className="flex-1 bg-slate-800 text-white py-6 rounded-[2rem] text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version Footer */}
      <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none opacity-20">
        <span className="text-[8px] font-black uppercase tracking-[0.8em] text-slate-500">v{pkg.version.split('.')[0]}</span>
      </div>
    </main>
  );
}
