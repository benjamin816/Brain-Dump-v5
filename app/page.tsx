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
    setStatus({ message: "Analyzing thought...", type: 'info' });
    
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
          message: result.calendar_routed ? "Routed to Calendar" : "Note saved", 
          type: 'success' 
        });
        await fetchNotes();
        setTimeout(() => setStatus(null), 3000);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Processing error:", error);
      setStatus({ message: "Failed to save note.", type: 'error' });
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

  return (
    <main className="min-h-screen max-w-3xl mx-auto px-6 py-16 md:py-24">
      {/* Header */}
      <header className="mb-12">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">Brain Dump</h1>
        <p className="text-sm text-gray-500 mt-1">Capture thoughts, tasks, and events instantly.</p>
      </header>

      {/* Input Area */}
      <section className="mb-16">
        <div className="notion-card p-1 rounded-2xl bg-white">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) processNewNote();
            }}
            placeholder="What's on your mind?"
            className="w-full bg-transparent border-none focus:ring-0 text-lg p-5 resize-none min-h-[120px] placeholder:text-gray-300 text-gray-800"
            disabled={isProcessing}
          />
          <div className="flex items-center justify-between p-3 border-t border-gray-50">
            <div className="px-2">
              {status && (
                <span className={`text-xs font-medium ${
                  status.type === 'error' ? 'text-red-500' : 'text-blue-500'
                }`}>
                  {status.message}
                </span>
              )}
            </div>
            <button
              onClick={processNewNote}
              disabled={isProcessing || !inputValue.trim()}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                isProcessing || !inputValue.trim()
                  ? "bg-gray-50 text-gray-300 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              }`}
            >
              {isProcessing ? "Syncing..." : "Save Note"}
            </button>
          </div>
        </div>
      </section>

      {/* Navigation */}
      <section className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeCategory === cat
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button 
            onClick={fetchNotes}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh"
          >
            <i className={`fa-solid fa-rotate-right text-xs ${isLoading ? 'fa-spin' : ''}`}></i>
          </button>
        </div>
      </section>

      {/* Notes Feed */}
      <section className="space-y-4">
        {isLoading && notes.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse"></div>
            ))}
          </div>
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <div key={note.id} className="notion-card group p-6 rounded-2xl bg-white relative">
              <button 
                onClick={() => deleteNote(note.id)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-2 text-gray-300 hover:text-red-500"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
              
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                  {note.category}
                </span>
                <span className="text-[10px] text-gray-400 font-medium">
                  {new Date(note.created_at_server).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </span>
                {note.item_type === 'event' && (
                  <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded font-bold uppercase">
                    Event
                  </span>
                )}
              </div>

              <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                {note.text}
              </p>
            </div>
          ))
        ) : (
          <div className="py-20 text-center border border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-400 text-sm">No notes found in this category.</p>
          </div>
        )}
      </section>

      <footer className="mt-24 pt-8 border-t border-gray-100 text-center">
        <p className="text-[10px] text-gray-300 uppercase tracking-widest font-medium">
          Personal Second Brain &bull; Webhook Sync Active
        </p>
      </footer>
    </main>
  );
}