'use client';

import { useState, useEffect, useRef } from 'react';

// Inline SVG icons (no external dependency)
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const MicIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
);

export default function Home() {
  const [topic, setTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [model, setModel] = useState<'nvidia' | 'gemini-2.5' | 'gemini-flash-lite'>('gemini-flash-lite');
  const [downloadUrl, setDownloadUrl] = useState<{url: string, filename: string} | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);

  const loadingSteps = [
    "Research",
    "Structure",
    "Layouts",
    "Icons",
    "Render"
  ];

  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      setLoadingStep((prev) => (prev < loadingSteps.length - 1 ? prev + 1 : prev));
    }, 3000); 
    return () => clearInterval(interval);
  }, [isGenerating]);

  const handleGenerate = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsGenerating(true);
    setLoadingStep(0);
    setError(null);
    setDownloadUrl(null);

    try {
      // Call the API directly if NEXT_PUBLIC_API_URL is provided, 
      // otherwise fallback to the Next.js rewrite (local dev).
      // This directly bypasses Vercel/Netlify's strict 10-second proxy timeouts!
      const baseUrl = process.env.NEXT_PUBLIC_API_URL 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '') // remove trailing slash if present
        : '';
        
      let response: Response;

      if (file || images.length > 0) {
        // Send as multipart FormData when a document or images are attached
        const formData = new FormData();
        formData.append('topic', topic);
        formData.append('model', model);
        if (file) {
          formData.append('document', file);
        }
        images.forEach(img => {
          formData.append('images', img);
        });

        response = await fetch(`${baseUrl}/api/presentations/export`, {
          method: 'POST',
          body: formData,
        });
      } else {
        // Send as JSON when no files (backward compatible)
        response = await fetch(`${baseUrl}/api/presentations/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic, model }),
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
          const lines = buffer.split('\n');
          // Keep the last partial line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const data = JSON.parse(line);
              
              if (data.status === 'progress') {
                setLoadingStep(data.step);
              } else if (data.status === 'error') {
                throw new Error(data.message || 'Error generating presentation');
              } else if (data.status === 'complete' && data.pptxBase64) {
                setLoadingStep(4);
                // Convert base64 to blob
                const byteCharacters = atob(data.pptxBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
                
                const url = window.URL.createObjectURL(blob);
                const filename = `${topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`;
                
                setDownloadUrl({ url, filename });

                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                a.remove();
              }
            } catch (parseErr: any) {
              // Ignore partial JSON parsing errors if somehow it wasn't split correctly
              if (parseErr.name !== 'SyntaxError') {
                throw parseErr;
              }
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
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
    <div className="min-h-screen bg-[var(--color-brand-cream)] text-[var(--color-brand-dark)] font-sans flex flex-col">
      <style>{`
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(300%); }
          100% { transform: translateX(-100%); }
        }
        .animate-loading-slide {
          animation: loading-slide 2s infinite ease-in-out;
        }
      `}</style>
      
      {/* Header */}
      <header className="px-8 py-6 border-b border-[var(--color-brand-border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[var(--color-brand-orange)] flex items-center justify-center">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          <h1 className="text-2xl font-bold tracking-widest text-[var(--color-brand-warm)]">DECKORA</h1>
        </div>
        <nav className="text-sm font-medium tracking-wide">
          <a href="#" className="hover:text-[var(--color-brand-orange)] transition">Templates</a>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-2xl w-full text-center space-y-8">
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight px-2" style={{ fontFamily: 'Georgia, serif' }}>
            Generate <span className="text-[var(--color-brand-orange)]">Beautiful</span> Presentations
          </h2>
          <p className="text-base sm:text-lg text-[var(--color-brand-warm)] max-w-lg mx-auto leading-relaxed px-4">
            Enter any topic below, or upload a document. Our AI will research, write, and design a stunning PowerPoint for you in seconds.
          </p>

          <div className="mt-8 max-w-2xl mx-auto px-2">
            <form onSubmit={handleGenerate} className={`relative shadow-xl rounded-3xl overflow-hidden bg-white border transition-colors duration-300 ${isGenerating ? 'border-[var(--color-brand-orange)] shadow-orange-500/20' : 'border-[var(--color-brand-border)]'} p-3 flex flex-col`}>
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
                    <span key={`${img.name}-${idx}`} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--color-brand-cream)] text-xs font-medium text-[var(--color-brand-dark)] border border-[var(--color-brand-border)]">
                      <ImageIcon />
                      {img.name}
                      <button
                        type="button"
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
                  <label title="Add Document" className="p-2 text-[var(--color-brand-border)] hover:text-[var(--color-brand-dark)] transition-colors rounded-full hover:bg-[var(--color-brand-cream)] cursor-pointer flex items-center justify-center">
                    <PlusIcon />
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      className="hidden"
                      onChange={(e) => {
                        const selected = e.target.files?.[0] || null;
                        setFile(selected);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <label title="Add Images" className="p-2 text-[var(--color-brand-border)] hover:text-[var(--color-brand-dark)] transition-colors rounded-full hover:bg-[var(--color-brand-cream)] cursor-pointer flex items-center justify-center">
                    <ImageIcon />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files || []);
                        if (images.length + selected.length > 8) {
                          alert("You can only upload up to 8 images.");
                          return;
                        }
                        setImages(prev => [...prev, ...selected]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                  <div className="relative group">
                    <select 
                      value={model} 
                      onChange={(e) => setModel(e.target.value as 'nvidia' | 'gemini-2.5' | 'gemini-flash-lite')}
                      disabled={isGenerating}
                      className="appearance-none bg-transparent text-[var(--color-brand-warm)] hover:text-[var(--color-brand-dark)] font-medium text-xs sm:text-sm outline-none cursor-pointer px-2 py-2 pr-4 transition-colors"
                    >
                      <option value="gemini-flash-lite">Gemini Flash Lite</option>
                      <option value="gemini-2.5">Gemini 2.5</option>
                      <option value="nvidia">NVIDIA 3.1</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-[var(--color-brand-warm)] group-hover:text-[var(--color-brand-dark)]">
                      <svg className="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  
                  <button type="button" className="p-2 text-[var(--color-brand-border)] hover:text-[var(--color-brand-dark)] transition-colors rounded-full hover:bg-[var(--color-brand-cream)] hidden sm:block cursor-pointer">
                    <MicIcon />
                  </button>

                  <button 
                    type="submit"
                    disabled={isGenerating || !topic.trim()}
                    className={`ml-1 p-2 rounded-full flex items-center justify-center transition-all ${
                      isGenerating || !topic.trim() 
                        ? 'bg-[var(--color-brand-cream)] text-[var(--color-brand-border)] cursor-not-allowed' 
                        : 'bg-black text-white hover:bg-gray-800 shadow-md'
                    }`}
                  >
                    <ArrowUpIcon />
                  </button>
                </div>
              </div>
            </form>

            {/* Success Download Button for Mobile */}
            {downloadUrl && !isGenerating && (
              <div className="mt-6 flex flex-col items-center">
                <a 
                  href={downloadUrl.url} 
                  download={downloadUrl.filename}
                  className="px-8 py-4 bg-[var(--color-brand-orange)] text-white font-bold rounded-2xl shadow-lg hover:bg-orange-600 transition-all transform hover:scale-105 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download Presentation
                </a>
                <p className="text-xs text-[var(--color-brand-warm)] mt-2">
                  If the download didn&apos;t start automatically, tap the button above.
                </p>
              </div>
            )}

            {/* Creative Loading State */}
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isGenerating ? 'max-h-32 opacity-100 mt-6' : 'max-h-0 opacity-0 mt-0'}`}>
              <div className="text-left bg-white rounded-xl border border-[var(--color-brand-border)] p-6 pb-10 shadow-sm relative">
                <div className="relative flex justify-between items-center w-full mt-2 px-2">
                  {/* Background line */}
                  <div className="absolute top-1/2 left-0 w-full h-1 bg-[var(--color-brand-cream)] -translate-y-1/2 rounded-full"></div>
                  {/* Animated fill line */}
                  <div 
                    className="absolute top-1/2 left-0 h-1 bg-[var(--color-brand-orange)] -translate-y-1/2 rounded-full transition-all duration-[3000ms] ease-linear"
                    style={{ width: `${(loadingStep / (loadingSteps.length - 1)) * 100}%` }}
                  ></div>
                  
                  {/* Nodes */}
                  {loadingSteps.map((step, index) => {
                    const isActive = index <= loadingStep;
                    const isCurrent = index === loadingStep;
                    return (
                      <div key={step} className="relative z-10 flex flex-col items-center">
                        <div 
                          className={`w-4 h-4 rounded-full border-2 transition-all duration-500 flex items-center justify-center ${
                            isActive 
                              ? 'bg-[var(--color-brand-orange)] border-[var(--color-brand-orange)] scale-110' 
                              : 'bg-white border-[var(--color-brand-border)]'
                          }`}
                        >
                          {isActive && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                        </div>
                        <span 
                          className={`absolute top-6 text-[9px] md:text-[10px] font-bold tracking-wider uppercase transition-colors duration-500 whitespace-nowrap ${
                            isCurrent ? 'text-[var(--color-brand-orange)] block' : (isActive ? 'text-[var(--color-brand-dark)] hidden sm:block' : 'text-[var(--color-brand-warm)] hidden sm:block')
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

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
