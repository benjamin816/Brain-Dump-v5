"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Note, Category } from '@/types';
import { CategoryFilter } from '@/components/CategoryFilter';
import { NoteCard } from '@/components/NoteCard';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>(Category.ALL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch('/api/entries');
      const data = await res.json();
      if (data.ok) {
        const sorted = data.entries.sort((a: Note, b: Note) => 
          new Date(b.created_at_server).getTime() - new Date(a.created_at_server).getTime()
        );
        setNotes(sorted);
      }
    } catch (e) {
      console.error("Failed to fetch notes", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
    const interval = setInterval(fetchNotes, 15000); // Faster polling for Siri updates
    return () => clearInterval(interval);
  }, [fetchNotes]);

  const processNewNote = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setLastAction("Thinking...");
    
    try {
      const response = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: inputValue,
          created_at: new Date().toISOString() 
        }),
      });

      const result = await response.json();
      if (result.ok) {
        setInputValue('');
        setLastAction(result.calendar_routed ? "Routed to Calendar! 📅" : "Captured and Categorized! ✅");
        await fetchNotes();
        setTimeout(() => setLastAction(null), 4000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Processing error:", error);
      setLastAction("System Error. Try again.");
      setTimeout(() => setLastAction(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      processNewNote();
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== id));
      }
    } catch (e) {
      console.error("Delete error", e);
    }
  };

  const filteredNotes = notes.filter(n => 
    activeCategory === Category.ALL || n.category === activeCategory
  );

  const counts = Object.values(Category).reduce((acc, cat) => {
    if (cat === Category.ALL) {
      acc[cat] = notes.length;
    } else {
      acc[cat] = notes.filter(n => n.category === cat).length;
    }
    return acc;
  }, {} as Record<Category, number>);

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-6 py-12 md:py-24 selection:bg-indigo-500/40">
      {/* Dynamic Background elements */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>
      </div>

      {/* Header Area */}
      <header className="mb-16 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/60">AI Webhook Synchronized</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-black text-white tracking-tighter mb-4 text-center leading-tight">
          BRAIN<span className="text-white/20">DUMP</span>
        </h1>
        
        <div className="flex items-center gap-6 mt-2">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-white">{notes.length}</span>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Thoughts</span>
          </div>
          <div className="w-px h-8 bg-white/10"></div>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-indigo-400">{notes.filter(n => n.item_type === 'event').length}</span>
            <span className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Events</span>
          </div>
        </div>
      </header>

      {/* Command Center Input */}
      <section className="mb-20 relative group max-w-3xl mx-auto">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[2.5rem] blur-2xl opacity-10 group-focus-within:opacity-25 transition duration-500"></div>
        <div className="glass relative rounded-[2.2rem] p-4 shadow-2xl border-white/10">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Dump a thought, task, or meeting..."
            className="w-full bg-transparent border-none focus:ring-0 text-xl md:text-2xl p-6 resize-none min-h-[140px] placeholder:text-slate-700 text-white font-medium leading-relaxed"
            disabled={isProcessing}
          />
          <div className="flex items-center justify-between px-6 pb-4 pt-2">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-[0.2em]">
                <i className="fa-solid fa-microchip text-indigo-500"></i>
                <span>Gemini 3 Flash</span>
              </div>
              {lastAction && (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                  <span className="text-xs text-indigo-400 font-bold italic">{lastAction}</span>
                </div>
              )}
            </div>
            <button
              onClick={processNewNote}
              disabled={isProcessing || !inputValue.trim()}
              className={`group flex items-center gap-3 px-10 py-4 rounded-2xl font-black transition-all ${
                isProcessing || !inputValue.trim()
                  ? "bg-white/5 text-white/20 grayscale pointer-events-none border border-white/5"
                  : "bg-white text-black hover:scale-[1.03] active:scale-[0.97] shadow-xl shadow-white/10"
              }`}
            >
              {isProcessing ? (
                <i className="fa-solid fa-circle-notch fa-spin"></i>
              ) : (
                <>
                  <span className="uppercase tracking-widest text-[11px]">Sync Note</span>
                  <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-40 group-hover:opacity-100 transition-opacity"></i>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Navigation & Feed */}
      <section className="space-y-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 sticky top-8 z-30 py-4">
          <div className="bg-[#020617]/80 backdrop-blur-xl rounded-3xl p-1.5 border border-white/5 shadow-2xl">
            <CategoryFilter 
              activeCategory={activeCategory} 
              onSelectCategory={setActiveCategory}
              counts={counts}
            />
          </div>
          <button 
            onClick={fetchNotes}
            className="self-end md:self-auto text-slate-500 hover:text-white transition-all text-xs font-bold uppercase tracking-widest flex items-center gap-3 px-6 py-3 rounded-2xl border border-white/5 hover:bg-white/5"
          >
            <i className={`fa-solid fa-arrow-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i>
            <span>Refresh Feed</span>
          </button>
        </div>

        {isLoading && notes.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-64 bg-white/[0.02] rounded-[2.5rem] border border-white/5 animate-pulse"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => (
                <NoteCard key={note.id} note={note} onDelete={deleteNote} />
              ))
            ) : (
              <div className="col-span-full py-40 text-center border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                <div className="text-white/10 mb-8">
                  <i className="fa-solid fa-feather-pointed text-8xl"></i>
                </div>
                <h3 className="text-white/40 font-black text-2xl uppercase tracking-tighter">Your mind is clear</h3>
                <p className="text-slate-600 text-sm mt-3 font-medium max-w-xs mx-auto">Use the Siri Shortcut or the input above to begin the dump.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Industrial Footer */}
      <footer className="mt-40 pt-16 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 opacity-40 hover:opacity-100 transition-opacity">
        <div className="flex flex-col gap-2">
          <p className="text-white font-black text-xs tracking-[0.3em] uppercase">Brain Dump v5.5.0</p>
          <p className="text-slate-500 text-[10px] font-mono">Build: NextJS_14_Stable_2024</p>
        </div>
        <div className="flex gap-10">
          <a href="#" className="text-slate-500 hover:text-blue-400 text-[10px] font-bold uppercase tracking-widest transition-colors">API Docs</a>
          <a href="#" className="text-slate-500 hover:text-indigo-400 text-[10px] font-bold uppercase tracking-widest transition-colors">Calendar Agent</a>
          <a href="#" className="text-slate-500 hover:text-purple-400 text-[10px] font-bold uppercase tracking-widest transition-colors">Siri Config</a>
        </div>
      </footer>
    </main>
  );
}
