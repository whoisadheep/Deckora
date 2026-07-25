'use client';

import { useState, useEffect, useRef } from 'react';
import { FadeUpText } from '../components/ui/FadeUpText';
import { GlowingBox } from '../components/ui/GlowingBox';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import { motion, AnimatePresence } from 'framer-motion';

// Animated SVG icons
const PlusIcon = () => (
  <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.9 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </motion.svg>
);
const ImageIcon = () => (
  <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" whileHover={{ scale: 1.1, y: -2 }} whileTap={{ scale: 0.9 }}>
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </motion.svg>
);
const MicIcon = ({ isListening }: { isListening?: boolean }) => (
  <motion.svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.9 }} className={isListening ? "text-red-500 animate-pulse" : ""}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </motion.svg>
);
const ArrowUpIcon = () => (
  <motion.svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" whileHover={{ y: -3 }} whileTap={{ scale: 0.9, y: 0 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </motion.svg>
);
const HistoryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

interface HistoryItem {
  id: string;
  topic: string;
  timestamp: number;
  model: string;
  theme: string;
  downloadUrl: string;
}

export default function Home() {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const [model, setModel] = useState<'nvidia' | 'gemini-2.5' | 'gemini-flash-lite'>('gemini-flash-lite');
  const [theme, setTheme] = useState('default');
  const [downloadUrl, setDownloadUrl] = useState<{url: string, filename: string} | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  
  // New features state
  const abortControllerRef = useRef<AbortController | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const loadingSteps = [
    "Research",
    "Structure",
    "Layouts",
    "Icons",
    "Render"
  ];

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('deckora_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (e) {}
    }
  }, []);

  // Save history
  const saveToHistory = (item: HistoryItem) => {
    const newHistory = [item, ...history.filter(h => h.id !== item.id)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('deckora_history', JSON.stringify(newHistory));
  };

  const handleMicClick = () => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setTopic(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setError("Generation cancelled by user.");
    }
  };

  const handleGenerate = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setLoadingStep(0);
    setCurrentSlide(0);
    setTotalSlides(0);
    setError(null);
    setDownloadUrl(null);
    setPreviewImages([]);

    abortControllerRef.current = new AbortController();

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') 
        : '';
        
      let response: Response;

      if (file || images.length > 0) {
        const formData = new FormData();
        formData.append('topic', topic);
        formData.append('model', model);
        formData.append('theme', theme);
        if (file) formData.append('document', file);
        images.forEach(img => formData.append('images', img));

        response = await fetch(`${baseUrl}/api/presentations/export`, {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal
        });
      } else {
        response = await fetch(`${baseUrl}/api/presentations/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, model, theme }),
          signal: abortControllerRef.current.signal
        });
      }

      const response_final = response;

      if (!response_final.ok) {
        const text = await response_final.text();
        let errMsg = 'Failed to generate presentation';
        try {
          const errorData = JSON.parse(text);
          errMsg = errorData.message || errorData.error || errMsg;
        } catch {
          if (text.includes('Unsupported file type') || text.includes('File too large')) {
             errMsg = text.match(/(Unsupported file type[^<]*|File too large[^<]*)/)?.[0] || errMsg;
          }
        }
        throw new Error(errMsg);
      }

      if (response_final.body) {
        const reader = response_final.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const data = JSON.parse(line);
              
              if (data.status === 'progress') {
                setLoadingStep(data.step);
                if (data.currentSlide && data.totalSlides) {
                  setCurrentSlide(data.currentSlide);
                  setTotalSlides(data.totalSlides);
                }
              } else if (data.status === 'error') {
                throw new Error(data.message || 'Error generating presentation');
              } else if (data.status === 'complete' && data.pptxBase64) {
                setLoadingStep(4);
                
                // Set previews
                if (data.previewImages && data.previewImages.length > 0) {
                  setPreviewImages(data.previewImages);
                }

                // URL for direct download button
                const dUrl = data.downloadUrl ? `${baseUrl}${data.downloadUrl}` : null;
                const filename = `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
                
                if (dUrl) {
                  setDownloadUrl({ url: dUrl, filename });
                  // Save history
                  saveToHistory({
                    id: Date.now().toString(),
                    topic,
                    timestamp: Date.now(),
                    model,
                    theme,
                    downloadUrl: dUrl
                  });
                } else {
                  // Fallback to blob if backend doesn't return static URL
                  const byteCharacters = atob(data.pptxBase64);
                  const byteNumbers = new Array(byteCharacters.length);
                  for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                  }
                  const byteArray = new Uint8Array(byteNumbers);
                  const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
                  const url = window.URL.createObjectURL(blob);
                  setDownloadUrl({ url, filename });
                }
              }
            } catch (parseErr: any) {
              if (parseErr.name !== 'SyntaxError') throw parseErr;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Ignored, handled in handleCancel
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && topic.trim()) {
        handleGenerate(e as unknown as React.FormEvent);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] text-[var(--color-brand-dark)] font-sans flex flex-col relative">
      <style>{`
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(300%); }
          100% { transform: translateX(-100%); }
        }
        .animate-loading-slide {
          animation: loading-slide 2s infinite ease-in-out;
        }
        /* Custom scrollbar for preview strip */
        .preview-strip::-webkit-scrollbar { height: 8px; }
        .preview-strip::-webkit-scrollbar-track { background: transparent; }
        .preview-strip::-webkit-scrollbar-thumb { background-color: var(--color-brand-border); border-radius: 4px; }
      `}</style>
      
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setLightboxImage(null)}
          >
            <motion.img 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              src={lightboxImage} 
              alt="Slide Preview" 
              className="max-w-full max-h-full rounded-xl shadow-2xl" 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Sidebar/Dropdown Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-full w-80 bg-white shadow-2xl border-l border-[var(--color-brand-border)] z-40 p-6 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg font-serif">Recent Decks</h3>
              <button aria-label="Close history" onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--color-brand-warm)]">No generated presentations yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {history.map(item => (
                  <div key={item.id} className="p-4 rounded-xl border border-[var(--color-brand-border)] bg-[var(--color-brand-cream)] flex flex-col gap-2">
                    <p className="font-bold text-sm truncate" title={item.topic}>{item.topic}</p>
                    <p className="text-xs text-[var(--color-brand-warm)]">{new Date(item.timestamp).toLocaleString()}</p>
                    <a href={item.downloadUrl} download={`${item.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`} className="text-xs font-bold text-[var(--color-brand-orange)] hover:underline flex items-center gap-1 mt-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="px-8 py-6 border-b border-[var(--color-brand-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-brand-orange)] flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-[var(--color-brand-warm)]">DECKORA</h1>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium tracking-wide">
          <button 
            onClick={() => setShowHistory(true)} 
            aria-label="View history"
            className="flex items-center gap-2 hover:text-[var(--color-brand-orange)] transition text-[var(--color-brand-warm)]"
          >
            <HistoryIcon />
            <span>Recent</span>
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center space-y-8">
          <FadeUpText delay={0.1}>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight px-2" style={{ fontFamily: 'Georgia, serif' }}>
              Generate <span className="text-[var(--color-brand-orange)]">Beautiful</span> Presentations
            </h2>
          </FadeUpText>
          <FadeUpText delay={0.3}>
            <p className="text-base sm:text-lg text-[var(--color-brand-warm)] max-w-lg mx-auto leading-relaxed px-4">
              Enter any topic below, or upload a document. Our AI will research, write, and design a stunning PowerPoint for you in seconds.
            </p>
          </FadeUpText>

          <FadeUpText delay={0.5}>
            <div className="mt-8 max-w-2xl mx-auto px-2">
              <GlowingBox isGlowing={isGenerating}>
                <form onSubmit={handleGenerate} className="p-3 flex flex-col relative rounded-3xl overflow-hidden bg-white border border-[var(--color-brand-border)]">
                  <textarea 
                    placeholder="Write a topic..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isGenerating}
                    rows={2}
                    className="w-full px-3 py-2 outline-none text-base md:text-lg bg-transparent text-[var(--color-brand-dark)] placeholder-[var(--color-brand-border)] disabled:opacity-50 min-w-0 resize-none"
                  />
                  {/* Attached file & image chips */}
                  {(file || images.length > 0) && (
                    <div className="flex flex-wrap items-center gap-2 px-3 py-1">
                      {file && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-brand-cream)] text-xs font-medium text-[var(--color-brand-dark)] border border-[var(--color-brand-border)]">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                          </svg>
                          {file.name}
                          <button
                            type="button"
                            aria-label="Remove document"
                            onClick={() => setFile(null)}
                            className="ml-0.5 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </span>
                      )}
                      {images.map((img, idx) => (
                        <span key={`${img.name}-${idx}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-brand-cream)] text-xs font-medium text-[var(--color-brand-dark)] border border-[var(--color-brand-border)] overflow-hidden">
                          <img src={URL.createObjectURL(img)} alt="thumbnail" className="w-4 h-4 object-cover rounded" />
                          <span className="max-w-[100px] truncate">{img.name}</span>
                          <button
                            type="button"
                            aria-label="Remove image"
                            onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                            className="ml-0.5 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between items-center px-1 mt-2">
                    <div className="flex items-center gap-1">
                      <label aria-label="Attach document" title="Add Document" className="p-2 text-[var(--color-brand-border)] hover:text-[var(--color-brand-dark)] transition-colors rounded-full hover:bg-[var(--color-brand-cream)] cursor-pointer flex items-center justify-center">
                        <PlusIcon />
                        <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => { const selected = e.target.files?.[0] || null; setFile(selected); e.target.value = ''; }} />
                      </label>
                      <label aria-label="Attach images" title="Add Images" className="p-2 text-[var(--color-brand-border)] hover:text-[var(--color-brand-dark)] transition-colors rounded-full hover:bg-[var(--color-brand-cream)] cursor-pointer flex items-center justify-center">
                        <ImageIcon />
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => { const selected = Array.from(e.target.files || []); if (images.length + selected.length > 8) { alert("Max 8 images."); return; } setImages(prev => [...prev, ...selected]); e.target.value = ''; }} />
                      </label>
                    </div>
                    
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Theme Picker */}
                      <div className="flex items-center gap-1 bg-[var(--color-brand-cream)] rounded-full px-2 py-1 mr-1">
                        <button type="button" aria-label="Default Theme" onClick={() => setTheme('default')} className={`w-4 h-4 rounded-full bg-[#C05A35] ${theme === 'default' ? 'ring-2 ring-offset-1 ring-black' : ''}`} />
                        <button type="button" aria-label="Ocean Theme" onClick={() => setTheme('ocean')} className={`w-4 h-4 rounded-full bg-[#4B89D4] ${theme === 'ocean' ? 'ring-2 ring-offset-1 ring-black' : ''}`} />
                        <button type="button" aria-label="Forest Theme" onClick={() => setTheme('forest')} className={`w-4 h-4 rounded-full bg-[#6A8D68] ${theme === 'forest' ? 'ring-2 ring-offset-1 ring-black' : ''}`} />
                      </div>

                      <div className="relative group">
                        <select 
                          value={model} 
                          onChange={(e) => setModel(e.target.value as any)}
                          disabled={isGenerating}
                          className="appearance-none bg-transparent text-[var(--color-brand-warm)] hover:text-[var(--color-brand-dark)] font-medium text-xs sm:text-sm outline-none cursor-pointer px-2 py-2 pr-4 transition-colors"
                        >
                          <option value="gemini-flash-lite">Gemini Flash</option>
                          <option value="gemini-2.5">Gemini 2.5</option>
                          <option value="nvidia">NVIDIA 3.1</option>
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-[var(--color-brand-warm)] group-hover:text-[var(--color-brand-dark)]">
                          <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                      </div>
                      
                      {!isGenerating && (
                        <button type="button" onClick={handleMicClick} aria-label="Voice input" className="p-2 text-[var(--color-brand-border)] hover:text-[var(--color-brand-dark)] transition-colors rounded-full hover:bg-[var(--color-brand-cream)] hidden sm:block cursor-pointer">
                          <MicIcon isListening={isListening} />
                        </button>
                      )}

                      {isGenerating ? (
                        <button 
                          type="button"
                          onClick={handleCancel}
                          className="ml-1 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-all shadow-sm"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button 
                          type="submit"
                          aria-label="Generate presentation"
                          disabled={!topic.trim()}
                          className={`ml-1 p-2 rounded-full flex items-center justify-center transition-all ${
                            !topic.trim() 
                              ? 'bg-[var(--color-brand-cream)] text-[var(--color-brand-border)] cursor-not-allowed' 
                              : 'bg-black text-white hover:bg-gray-800 shadow-md'
                          }`}
                        >
                          <ArrowUpIcon />
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </GlowingBox>

              {/* Success Previews & Download */}
              {downloadUrl && !isGenerating && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-8 flex flex-col items-center">
                  
                  {previewImages.length > 0 && (
                    <div className="w-full mb-6">
                      <p className="text-sm font-bold font-serif mb-3 text-left pl-2">Slide Previews:</p>
                      <div className="flex overflow-x-auto gap-4 pb-4 preview-strip px-2">
                        {previewImages.map((src, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => setLightboxImage(src)}
                            className="flex-shrink-0 cursor-pointer group rounded-lg overflow-hidden border-2 border-transparent hover:border-[var(--color-brand-orange)] transition-colors shadow-sm"
                          >
                            <img src={src} alt={`Slide ${idx + 1}`} className="h-32 object-cover group-hover:opacity-90 transition-opacity" />
                            <div className="text-center text-xs text-[var(--color-brand-warm)] mt-1 font-medium">{idx + 1}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <a 
                    href={downloadUrl.url} 
                    download={downloadUrl.filename}
                    className="px-8 py-4 bg-[var(--color-brand-orange)] text-white font-bold rounded-2xl shadow-lg hover:bg-orange-600 transition-all transform hover:scale-105 flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                    Download Presentation
                  </a>
                  <p className="text-xs text-[var(--color-brand-warm)] mt-3">
                    If the download didn&apos;t start automatically, tap the button above.
                  </p>
                </motion.div>
              )}

              {/* Creative Loading State */}
              <div className={`transition-all duration-500 ease-in-out overflow-hidden flex flex-col items-center justify-center ${isGenerating ? 'h-32 opacity-100 mt-6' : 'h-0 opacity-0 mt-0'}`}>
                <AnimatedLoader steps={loadingSteps} currentStep={loadingStep} />
                {currentSlide > 0 && totalSlides > 0 && (
                  <p className="text-xs font-bold text-[var(--color-brand-orange)] mt-2 font-serif tracking-widest uppercase animate-pulse">
                    Rendering slide {currentSlide} of {totalSlides}
                  </p>
                )}
              </div>
            </div>
          </FadeUpText>

          {error && (
            <p className="text-red-500 mt-4 text-sm font-medium">{error}</p>
          )}

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12 md:pt-16 max-w-3xl mx-auto border-t border-[var(--color-brand-border)] text-center px-4 mb-8">
            <div className="flex flex-col items-center">
              <h3 className="font-bold mb-2">Automated Research</h3>
              <p className="text-sm text-[var(--color-brand-warm)]">AI writes comprehensive, intelligent outlines.</p>
            </div>
            <div className="flex flex-col items-center">
              <h3 className="font-bold mb-2">Smart Layouts</h3>
              <p className="text-sm text-[var(--color-brand-warm)]">Perfectly balanced cards, lists, and hero sections.</p>
            </div>
            <div className="flex flex-col items-center">
              <h3 className="font-bold mb-2">Native PPTX</h3>
              <p className="text-sm text-[var(--color-brand-warm)]">Downloads as a fully editable PowerPoint file.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-6 text-sm text-[var(--color-brand-warm)] border-t border-[var(--color-brand-border)]">
        &copy; {new Date().getFullYear()} Deckora Inc. All rights reserved.
      </footer>
    </div>
  );
}
