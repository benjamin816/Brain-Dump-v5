
import React, { useState, useEffect, useCallback } from 'react';
import { Note, Category } from './types';
import { analyzeNote } from './services/geminiService';
import { forwardToCalendar } from './services/calendarService';
import { CategoryFilter } from './components/CategoryFilter';
import { NoteCard } from './components/NoteCard';

const App: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>(Category.ALL);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('brain_dump_notes_v5');
    if (saved) {
      try {
        setNotes(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load notes", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('brain_dump_notes_v5', JSON.stringify(notes));
  }, [notes]);

  const processNewNote = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    setIsProcessing(true);
    setLastAction("Analyzing with Gemini...");
    
    try {
      const analysis = await analyzeNote(content);
      let forwarded = false;

      if (analysis.isEvent) {
        setLastAction("Routing to Calendar Agent...");
        forwarded = await forwardToCalendar(content);
      }

      const newNote: Note = {
        id: crypto.randomUUID(),
        content,
        category: analysis.category,
        timestamp: Date.now(),
        isEvent: analysis.isEvent,
        forwardedToCalendar: forwarded,
        metadata: {
          detectedTime: analysis.detectedTime,
          summary: analysis.summary
        }
      };

      setNotes(prev => [newNote, ...prev]);
      setInputValue('');
      setLastAction(null);
    } catch (error) {
      console.error("Processing error:", error);
      setLastAction("Failed to process note correctly.");
      setTimeout(() => setLastAction(null), 3000);
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      processNewNote(inputValue);
    }
  };

  const deleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
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
    <div className="min-h-screen max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* Header */}
      <header className="mb-10 text-center">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 mb-2">
          Brain Dump <span className="text-slate-600 font-light">v5</span>
        </h1>
        <p className="text-slate-400 text-sm">Intelligent note capturing and routing</p>
      </header>

      {/* Input Box */}
      <section className="mb-12 sticky top-4 z-50">
        <div className="glass rounded-3xl p-2 shadow-2xl shadow-blue-500/10 focus-within:ring-2 focus-within:ring-blue-500/40 transition-all">
          <div className="relative">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Dump your thought here... (Cmd+Enter to save)"
              className="w-full bg-transparent border-none focus:ring-0 text-lg p-4 resize-none min-h-[100px] placeholder:text-slate-600"
              disabled={isProcessing}
            />
            <div className="flex items-center justify-between px-4 pb-2">
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <i className="fa-solid fa-brain"></i>
                <span>Gemini 3 Flash Enhanced</span>
              </div>
              <button
                onClick={() => processNewNote(inputValue)}
                disabled={isProcessing || !inputValue.trim()}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-semibold transition-all ${
                  isProcessing || !inputValue.trim()
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40"
                }`}
              >
                {isProcessing ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Processing</span>
                  </>
                ) : (
                  <>
                    <span>Dump</span>
                    <i className="fa-solid fa-arrow-up-long"></i>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
        {lastAction && (
          <div className="mt-2 text-center text-xs text-blue-400 animate-pulse">
            {lastAction}
          </div>
        )}
      </section>

      {/* Filter Bar */}
      <section className="mb-8">
        <CategoryFilter 
          activeCategory={activeCategory} 
          onSelectCategory={setActiveCategory}
          counts={counts}
        />
      </section>

      {/* Notes List */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredNotes.length > 0 ? (
          filteredNotes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={deleteNote} />
          ))
        ) : (
          <div className="col-span-full py-20 text-center">
            <div className="text-slate-600 mb-4">
              <i className="fa-regular fa-folder-open text-5xl"></i>
            </div>
            <h3 className="text-slate-400 font-medium">No notes in this category</h3>
            <p className="text-slate-600 text-sm mt-1">Start dumping your thoughts above</p>
          </div>
        )}
      </section>

      {/* Footer Info */}
      <footer className="mt-20 pt-8 border-t border-slate-800 text-center text-slate-600 text-[11px] space-y-2">
        <p>Brain Dump v5 • Connected to Calendar Agent</p>
        <div className="flex justify-center gap-4">
          <span className="flex items-center gap-1"><i className="fa-solid fa-bolt text-amber-500"></i> Auto-Categorize</span>
          <span className="flex items-center gap-1"><i className="fa-solid fa-calendar-days text-blue-500"></i> Smart Calendar Routing</span>
          <span className="flex items-center gap-1"><i className="fa-solid fa-mobile-screen-button text-purple-500"></i> Siri Webhook Compatible</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
