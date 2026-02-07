
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Note, Category, ItemType } from '@/types';
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
        // Sort by server creation time descending
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
    // Poll for new notes every 30 seconds to catch Siri updates
    const interval = setInterval(fetchNotes, 30000);
    return () => clearInterval(interval);
  }, [fetchNotes]);

  const processNewNote = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setLastAction("Analyzing with Gemini...");
    
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
        setLastAction("Note captured and categorized!");
        await fetchNotes();
        setTimeout(() => setLastAction(null), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Processing error:", error);
      setLastAction("Failed to process note.");
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
    <main className="min-h-screen max-w-5xl mx-auto px-4 py-8 md:py-16 selection:bg-blue-500/30">
      {/* Header */}
      <header className="mb-12 flex flex-col items-center">
        <div className="inline-flex items-center gap-3 mb-4 bg-blue-500/10 px-4 py-1.5 rounded-full border border-blue-500/20">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-50"></span>
          </span>
          <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">System Active</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter mb-4 text-center">
          BRAIN<span className="text-slate-700">DUMP</span>
        </h1>
        <p className="text-slate-400 text-center max-w-md leading-relaxed">
          Your second brain, synced via Siri. Auto-categorized by Gemini 3 Flash.
        </p>
      </header>

      {/* Primary Input */}
      <section className="mb-16 relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
        <div className="glass relative rounded-[1.8rem] p-3 shadow-2xl shadow-black/40 border-white/5">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="What's on your mind? (Cmd+Enter)"
            className="w-full bg-transparent border-none focus:ring-0 text-xl p-5 resize-none min-h-[120px] placeholder:text-slate-600 text-white font-medium"
            disabled={isProcessing}
          />
          <div className="flex items-center justify-between px-5 pb-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest">
                <i className="fa-solid fa-bolt text-blue-500"></i>
                <span>Webhook Ready</span>
              </div>
              {lastAction && (
                <span className="text-xs text-blue-400 font-medium animate-pulse">{lastAction}</span>
              )}
            </div>
            <button
              onClick={processNewNote}
              disabled={isProcessing || !inputValue.trim()}
              className={`group flex items-center gap-3 px-8 py-3 rounded-2xl font-bold transition-all ${
                isProcessing || !inputValue.trim()
                  ? "bg-slate-800 text-slate-600 grayscale"
                  : "bg-white text-black hover:bg-blue-50 hover:scale-[1.02] active:scale-[0.98]"
              }`}
            >
              {isProcessing ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <>
                  <span>Dump</span>
                  <i className="fa-solid fa-arrow-right-long transition-transform group-hover:translate-x-1"></i>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <CategoryFilter 
            activeCategory={activeCategory} 
            onSelectCategory={setActiveCategory}
            counts={counts}
          />
          <button 
            onClick={fetchNotes}
            className="text-slate-500 hover:text-white transition-colors text-sm flex items-center gap-2 px-4 py-2"
          >
            <i className={`fa-solid fa-rotate ${isLoading ? 'fa-spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>

        {isLoading && notes.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-48 bg-slate-800/50 rounded-3xl border border-white/5"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredNotes.length > 0 ? (
              filteredNotes.map((note) => (
                <NoteCard key={note.id} note={note} onDelete={deleteNote} />
              ))
            ) : (
              <div className="col-span-full py-32 text-center border-2 border-dashed border-slate-800 rounded-[2.5rem]">
                <div className="text-slate-800 mb-6">
                  <i className="fa-solid fa-ghost text-6xl"></i>
                </div>
                <h3 className="text-slate-500 font-bold text-xl">The void is empty</h3>
                <p className="text-slate-700 text-sm mt-2 font-medium">Capture a thought or wait for a Siri sync.</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-32 pt-12 border-t border-white/5 flex flex-col items-center gap-4">
        <div className="flex gap-8">
          <a href="/api/inbox" className="text-slate-500 hover:text-blue-400 text-xs font-mono transition-colors">Endpoint Documentation</a>
          <a href="https://ai.google.dev" className="text-slate-500 hover:text-blue-400 text-xs font-mono transition-colors">Powered by Gemini</a>
        </div>
        <p className="text-slate-700 text-[10px] font-bold uppercase tracking-[0.2em]">BRAINDUMP V5.2.0 • WEBHOOK OPERATIONAL</p>
      </footer>
    </main>
  );
}
