"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Note, Category } from '@/types';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>(Category.ALL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      setIsLoading(true);
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
    const interval = setInterval(fetchNotes, 30000); 
    return () => clearInterval(interval);
  }, [fetchNotes]);

  const processNewNote = async () => {
    if (!inputValue.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setStatus({ message: "Analyzing...", type: 'info' });
    
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
        setStatus({ 
          message: result.calendar_routed ? "Forwarded to Calendar" : "Thought Captured", 
          type: 'success' 
        });
        await fetchNotes();
        setTimeout(() => setStatus(null), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Processing error:", error);
      setStatus({ message: "Sync failed.", type: 'error' });
      setTimeout(() => setStatus(null), 3000);
    } finally {
      setIsProcessing(false);
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

  const categories = Object.values(Category);

  const getCategoryStyles = (cat: Category) => {
    switch (cat) {
      case Category.WORK: return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case Category.PERSONAL: return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
      case Category.CREATIVE: return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case Category.HEALTH: return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case Category.FINANCE: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case Category.SOCIAL: return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 sm:px-8 py-12 md:py-20 relative">
      
      {/* Header */}
      <header className="mb-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2 bg-gradient-to-r from-indigo-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
          Brain Dump
        </h1>
        <p className="text-slate-400 text-sm font-medium uppercase tracking-[0.2em]">
          AI-Powered Intelligence Layer
        </p>
      </header>

      {/* Sticky Input Area */}
      <section className="sticky top-6 z-50 mb-20 max-w-3xl mx-auto">
        <div className="glass p-2 rounded-[2rem] border-white/5 group shadow-2xl">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                processNewNote();
              }
            }}
            placeholder="What's the thought?"
            className="w-full bg-transparent border-none focus:ring-0 text-lg md:text-xl p-6 resize-none min-h-[140px] placeholder:text-slate-600 text-slate-100 transition-all"
            disabled={isProcessing}
          />
          <div className="flex items-center justify-between px-6 pb-4">
            <div className="flex-1">
              {status && (
                <div className={`flex items-center gap-2 animate-fade-in`}>
                   <div className={`w-1.5 h-1.5 rounded-full ${status.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'} animate-pulse`} />
                   <span className={`text-[11px] font-bold uppercase tracking-widest ${
                    status.type === 'error' ? 'text-rose-400' : 'text-indigo-400'
                  }`}>
                    {status.message}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={processNewNote}
              disabled={isProcessing || !inputValue.trim()}
              className={`flex items-center gap-3 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${
                isProcessing || !inputValue.trim()
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed border border-white/5"
                  : "bg-white text-slate-900 hover:scale-105 active:scale-95 shadow-xl shadow-indigo-500/10"
              }`}
            >
              {isProcessing ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Syncing</span>
                </>
              ) : (
                <>
                  <span>Dump</span>
                  <i className="fa-solid fa-arrow-up-right-from-square"></i>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Navigation & Filters */}
      <section className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "bg-slate-900/40 border-white/5 text-slate-500 hover:text-slate-300 hover:border-white/10"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
        <button 
          onClick={fetchNotes}
          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors"
        >
          <i className={`fa-solid fa-rotate-right ${isLoading ? 'fa-spin' : ''}`}></i>
          <span>Refresh Feed</span>
        </button>
      </section>

      {/* Notes Feed Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading && notes.length === 0 ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass h-48 rounded-3xl animate-pulse bg-white/5"></div>
            ))}
          </>
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div 
              key={note.id} 
              className="glass group p-8 rounded-[2rem] border-white/5 relative transition-all hover:-translate-y-1 hover:bg-white/[0.04] animate-fade-in"
            >
              <button 
                onClick={() => deleteNote(note.id)}
                className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-all p-2 text-slate-600 hover:text-rose-500 bg-slate-900/50 rounded-xl"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
              
              <div className="flex items-center gap-3 mb-6">
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-lg border ${getCategoryStyles(note.category as Category)}`}>
                  {note.category}
                </span>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">
                  {new Date(note.created_at_server).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {note.item_type === 'event' && (
                  <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1.5 rounded-lg font-black uppercase tracking-[0.2em]">
                    <i className="fa-solid fa-calendar-day mr-1.5"></i> Event
                  </span>
                )}
              </div>

              <p className="text-slate-200 text-lg leading-relaxed whitespace-pre-wrap mb-8">
                {note.text}
              </p>

              <div className="flex items-center gap-4 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-600">
                <div className="flex items-center gap-1.5">
                  <i className="fa-solid fa-fingerprint text-[10px]"></i>
                  <span>ID: {note.id.split('-')[0]}</span>
                </div>
                {note.time_bucket && note.time_bucket !== 'none' && (
                  <div className="flex items-center gap-1.5 text-indigo-400">
                    <i className="fa-regular fa-clock text-[10px]"></i>
                    <span>{note.time_bucket}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center glass rounded-[3rem] border-dashed border-white/10">
            <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-600">
              <i className="fa-solid fa-cloud-moon text-2xl"></i>
            </div>
            <h3 className="text-slate-300 font-semibold mb-1">No data in this sector</h3>
            <p className="text-slate-600 text-sm">Waiting for your next brain dump...</p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="mt-32 pb-12 text-center">
        <div className="inline-flex items-center gap-4 px-6 py-2 rounded-full border border-white/5 bg-slate-900/30">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[9px] text-slate-500 uppercase font-black tracking-[0.3em]">
            System Status: Synchronized &bull; Intelligence Layer Active
          </span>
        </div>
      </footer>
    </main>
  );
}
