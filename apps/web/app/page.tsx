'use client';

import { useState, useEffect, useRef } from 'react';
import { AnimatedLoader } from '../components/ui/AnimatedLoader';
import { motion, AnimatePresence } from 'framer-motion';

// SVG icons (motion removed for functional simplicity except state pulse)
const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const ImageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
  </svg>
);
const MicIcon = ({ isListening }: { isListening?: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={isListening ? "text-red-500 animate-pulse" : ""}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
  </svg>
);
const ArrowUpIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
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


export interface SlideData {
  section?: string;
  layout: string;
  kicker?: string;
  title: string;
  subtitle?: string;
  footerText?: string;
  bullets?: any[];
  slideIcon?: string;
  userImage?: string;
  mermaid?: string;
  speakerNotes?: string;
}

const C = {
  darkBrown:   '#3D322A',
  warmBrown:   '#5C4A3A',
  rustOrange:  '#C05A35',
  lightOrange: '#D4784B',
  cream:       '#F5F0EB',
  cardBg:      '#EDE5DC',
  cardBorder:  '#D8CFC5',
  cardDarkBg:  '#4A3C32',
  textDark:    '#2D241E',
  textMuted:   '#7A6E63',
  textLight:   '#E0D6CC',
  white:       '#FFFFFF',
  accentGold:  '#B8915A',
};

type ThemePalette = typeof C;

const THEMES: Record<string, ThemePalette> = {
  default: C,
  ocean: { darkBrown: '#1B2A47', warmBrown: '#2B4365', rustOrange: '#4B89D4', lightOrange: '#7AB0E6', cream: '#F0F4F8', cardBg: '#E1E8F0', cardBorder: '#C2D1E0', cardDarkBg: '#2B4365', textDark: '#1A2639', textMuted: '#64748B', textLight: '#E2E8F0', white: '#FFFFFF', accentGold: '#38BDF8' },
  forest: { darkBrown: '#2D3A2C', warmBrown: '#4A5D48', rustOrange: '#6A8D68', lightOrange: '#8AB088', cream: '#F2F5F1', cardBg: '#E5EBE3', cardBorder: '#C8D6C6', cardDarkBg: '#4A5D48', textDark: '#1F291E', textMuted: '#6B7B69', textLight: '#E3EBE2', white: '#FFFFFF', accentGold: '#D4AF37' }
};

function getSectionAccentColor(section: string | undefined, palette: ThemePalette): string {
  if (!section) return palette.rustOrange;
  const accents = [palette.rustOrange, palette.accentGold, palette.lightOrange];
  let hash = 0;
  for (let i = 0; i < section.length; i++) {
    hash = section.charCodeAt(i) + ((hash << 5) - hash);
  }
  return accents[Math.abs(hash) % accents.length] || palette.rustOrange;
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
  const [generatedSlides, setGeneratedSlides] = useState<SlideData[]>([]);
  const [lightboxSlide, setLightboxSlide] = useState<number | null>(null);
  
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
          const lines = buffer.split('\n');
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
                if (data.slides) setGeneratedSlides(data.slides);
                if (data.previewImages && data.previewImages.length > 0) {
                  setPreviewImages(data.previewImages);
                }

                // URL for direct download button
                const dUrl = data.downloadUrl ? `${baseUrl}${data.downloadUrl}` : null;
                const shortTopic = topic.split(' ').slice(0, 4).join('_').substring(0, 30).replace(/[^a-z0-9_]/gi, '').toLowerCase();
                const filename = `deck_${shortTopic}.pptx`;
                
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
        
        // Parse any remaining data in the buffer after the stream closes
        if (buffer.trim()) {
          try {
            const data = JSON.parse(buffer);
            if (data.status === 'complete' && data.pptxBase64) {
              setLoadingStep(4);
              if (data.slides) setGeneratedSlides(data.slides);
              if (data.previewImages && data.previewImages.length > 0) setPreviewImages(data.previewImages);
              const dUrl = data.downloadUrl ? `${baseUrl}${data.downloadUrl}` : null;
              const shortTopic = topic.split(' ').slice(0, 4).join('_').substring(0, 30).replace(/[^a-z0-9_]/gi, '').toLowerCase();
              const filename = `deck_${shortTopic}.pptx`;
              if (dUrl) {
                setDownloadUrl({ url: dUrl, filename });
                saveToHistory({ id: Date.now().toString(), topic, timestamp: Date.now(), model, theme, downloadUrl: dUrl });
              } else {
                const byteCharacters = atob(data.pptxBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
                const url = window.URL.createObjectURL(blob);
                setDownloadUrl({ url, filename });
              }
            }
          } catch (e) {
            // Ignore parse errors on remaining fragment
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

  
  const renderCSSSlide = (slide: SlideData, index: number, scale: number = 1, interactive: boolean = false) => {
    const palette: ThemePalette = THEMES[theme] || C;
    const isDark = slide.layout === 'cards_dark' || slide.layout === 'split_graphic';
    const bg = isDark ? palette.darkBrown : palette.cream;
    const textMain = isDark ? palette.white : palette.textDark;
    const textSub = isDark ? palette.textLight : palette.textMuted;
    const cardBg = isDark ? palette.cardDarkBg : palette.white;
    const cardBorder = isDark ? palette.cardDarkBg : palette.cardBorder;
    const accent = getSectionAccentColor(slide.section, palette);

    return (
      <div 
        key={index}
        onClick={() => interactive && setLightboxSlide(index)}
        className={`relative flex-shrink-0 flex flex-col overflow-hidden ${interactive ? 'cursor-pointer hover:ring-2 hover:ring-[var(--color-brand-orange)] transition-all' : ''}`}
        style={{ 
          width: 960 * scale, 
          height: 540 * scale, 
          backgroundColor: bg,
          border: `1px solid ${palette.cardBorder}`,
          transformOrigin: 'top left'
        }}
      >
        {/* Header */}
        <div style={{ padding: `${32 * scale}px ${48 * scale}px`, display: 'flex', flexDirection: 'column' }}>
          {slide.kicker && <div style={{ color: accent, fontSize: 14 * scale, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 * scale }}>{slide.kicker}</div>}
          <div style={{ color: textMain, fontSize: 36 * scale, fontWeight: 'bold', fontFamily: 'Georgia, serif', lineHeight: 1.2 }}>{slide.title}</div>
          {slide.subtitle && <div style={{ color: textSub, fontSize: 18 * scale, marginTop: 8 * scale, lineHeight: 1.4 }}>{slide.subtitle}</div>}
        </div>

        {/* Body based on layout */}
        <div style={{ flex: 1, padding: `0 ${48 * scale}px ${32 * scale}px`, display: 'flex', flexDirection: slide.layout === 'rows' ? 'column' : 'row', gap: 24 * scale, overflow: 'hidden' }}>
          {slide.layout === 'hero' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '60%', height: '4px', backgroundColor: accent }}></div>
            </div>
          )}
          
          {(slide.layout === 'cards_light' || slide.layout === 'cards_dark') && slide.bullets && (
            slide.bullets.map((b, i) => (
              <div key={i} style={{ flex: 1, backgroundColor: cardBg, border: `1px solid ${cardBorder}`, padding: 24 * scale, display: 'flex', flexDirection: 'column' }}>
                <div style={{ width: 32 * scale, height: 32 * scale, borderRadius: '50%', backgroundColor: accent, marginBottom: 16 * scale }}></div>
                <div style={{ color: textMain, fontSize: 18 * scale, fontWeight: 'bold', marginBottom: 8 * scale }}>{typeof b === 'string' ? b.split(':')[0] : b.title}</div>
                <div style={{ color: textSub, fontSize: 14 * scale, lineHeight: 1.5 }}>{typeof b === 'string' ? b.split(':').slice(1).join(':') : b.text}</div>
              </div>
            ))
          )}

          {slide.layout === 'rows' && slide.bullets && (
            slide.bullets.map((b, i) => (
              <div key={i} style={{ backgroundColor: cardBg, border: `1px solid ${cardBorder}`, padding: `${16 * scale}px ${24 * scale}px`, display: 'flex', alignItems: 'center', gap: 16 * scale }}>
                <div style={{ width: 12 * scale, height: 12 * scale, backgroundColor: accent }}></div>
                <div style={{ flex: 1, color: textMain, fontSize: 16 * scale, fontWeight: 'bold' }}>{typeof b === 'string' ? b : b.title}</div>
              </div>
            ))
          )}

          {slide.layout === 'diagram' && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 200 * scale, height: 200 * scale, borderRadius: '50%', border: `4px dashed ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMain, fontSize: 24 * scale, fontWeight: 'bold' }}>Core</div>
            </div>
          )}

          {slide.layout === 'split_graphic' && (
            <>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 * scale, justifyContent: 'center' }}>
                {slide.bullets?.map((b, i) => (
                  <div key={i} style={{ color: textMain, fontSize: 16 * scale, display: 'flex', alignItems: 'flex-start', gap: 8 * scale }}>
                    <span style={{ color: accent }}>•</span>
                    <span>{typeof b === 'string' ? b : b.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ flex: 1, backgroundColor: cardBg, border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <svg style={{ width: 48 * scale, height: 48 * scale, color: textSub, opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: `0 ${48 * scale}px ${24 * scale}px`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ color: textSub, fontSize: 12 * scale }}>{slide.footerText}</div>
           <div style={{ color: textSub, fontSize: 12 * scale }}>{index + 1}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-brand-cream)] text-[var(--color-brand-dark)] font-[system-ui,-apple-system,sans-serif] flex flex-col relative">
      <style>{`
        /* Custom scrollbar for preview strip */
        .preview-strip::-webkit-scrollbar { height: 8px; }
        .preview-strip::-webkit-scrollbar-track { background: transparent; }
        .preview-strip::-webkit-scrollbar-thumb { background-color: var(--color-brand-border); border-radius: 4px; }
      `}</style>
      
      {/* Lightbox */}
      <AnimatePresence>
        {(lightboxImage || lightboxSlide !== null) && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-[24px] cursor-pointer"
            onClick={() => { setLightboxImage(null); setLightboxSlide(null); }}
          >
            <motion.div 
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="shadow-2xl flex items-center justify-center"
            >
              {lightboxImage ? (
                <img src={lightboxImage} alt="Slide Preview" className="max-w-full max-h-[90vh] bg-white border border-[var(--color-brand-border)]" />
              ) : lightboxSlide !== null && generatedSlides[lightboxSlide] ? (
                <div style={{ transform: 'scale(min(1, calc((100vw - 48px) / 960)))', transformOrigin: 'center' }}>
                  {renderCSSSlide(generatedSlides[lightboxSlide], lightboxSlide, 1, false)}
                </div>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Sidebar/Dropdown Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 300 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed top-0 right-0 h-full w-[360px] bg-[var(--color-brand-cream)] shadow-2xl border-l border-[var(--color-brand-border)] z-40 p-[32px] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-[32px]">
              <h3 className="font-bold text-[24px]" style={{ fontFamily: 'Georgia, serif' }}>Recent Decks</h3>
              <button aria-label="Close history" onClick={() => setShowHistory(false)} className="p-[8px] hover:bg-[var(--color-brand-border)] rounded transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {history.length === 0 ? (
              <p className="text-[14px] text-[var(--color-brand-warm)]">No generated presentations yet.</p>
            ) : (
              <div className="flex flex-col gap-[16px]">
                {history.map(item => (
                  <div key={item.id} className="p-[16px] border border-[var(--color-brand-border)] bg-white flex flex-col gap-[8px]">
                    <p className="font-bold text-[14px] truncate" title={item.topic}>{item.topic}</p>
                    <p className="text-[12px] text-[var(--color-brand-warm)]">{new Date(item.timestamp).toLocaleString()}</p>
                    <a href={item.downloadUrl} download={`${item.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx`} className="text-[12px] font-bold text-[var(--color-brand-dark)] hover:text-[var(--color-brand-orange)] transition-colors flex items-center gap-[4px] mt-[4px]">
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
      <header className="px-[48px] py-[24px] border-b border-[var(--color-brand-border)] flex items-center justify-between">
        <div className="flex items-center gap-[8px]">
          <div className="w-[32px] h-[32px] bg-[var(--color-brand-dark)] flex items-center justify-center">
            <div className="w-[12px] h-[12px] bg-[var(--color-brand-cream)]"></div>
          </div>
          <h1 className="text-[20px] font-bold tracking-widest text-[var(--color-brand-dark)]">DECKORA</h1>
        </div>
        <nav className="flex items-center gap-[24px] text-[14px] font-medium tracking-wide">
          <button 
            onClick={() => setShowHistory(true)} 
            aria-label="View history"
            className="flex items-center gap-[8px] hover:text-[var(--color-brand-orange)] transition-colors text-[var(--color-brand-dark)]"
          >
            <HistoryIcon />
            <span>Recent</span>
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-[32px] lg:px-[64px] py-[64px]">
        {/* Asymmetric Hero Section */}
        <div className="max-w-[1200px] mx-auto flex flex-col lg:flex-row gap-[64px]">
          
          {/* Left Column: Copy and Form */}
          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-[48px] leading-[1.1] font-bold mb-[24px]" style={{ fontFamily: 'Georgia, serif' }}>
              Build fully-themed, native PowerPoint decks.
            </h2>
            <p className="text-[18px] text-[var(--color-brand-warm)] mb-[48px] max-w-[500px] leading-[1.6]">
              Enter a topic or attach a document, and Deckora structures, illustrates, and exports a complete .pptx file ready for presentation.
            </p>

            <form onSubmit={handleGenerate} className="flex flex-col relative bg-white border border-[var(--color-brand-border)]">
              <textarea 
                placeholder="Write a topic..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
                rows={3}
                className="w-full p-[24px] outline-none text-[16px] bg-transparent text-[var(--color-brand-dark)] placeholder-[var(--color-brand-border)] disabled:opacity-50 min-w-0 resize-none"
              />
              
              {/* Attached file & image chips */}
              {(file || images.length > 0) && (
                <div className="flex flex-wrap items-center gap-[8px] px-[24px] pb-[8px]">
                  {file && (
                    <span className="inline-flex items-center gap-[6px] px-[12px] py-[4px] bg-[var(--color-brand-cream)] text-[12px] font-medium text-[var(--color-brand-dark)] border border-[var(--color-brand-border)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
                      </svg>
                      {file.name}
                      <button
                        type="button"
                        aria-label="Remove document"
                        onClick={() => setFile(null)}
                        className="ml-[4px] hover:text-[var(--color-brand-orange)] transition-colors cursor-pointer"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  )}
                  {images.map((img, idx) => (
                    <span key={`${img.name}-${idx}`} className="inline-flex items-center gap-[6px] px-[12px] py-[4px] bg-[var(--color-brand-cream)] text-[12px] font-medium text-[var(--color-brand-dark)] border border-[var(--color-brand-border)] overflow-hidden">
                      <img src={URL.createObjectURL(img)} alt="thumbnail" className="w-[16px] h-[16px] object-cover" />
                      <span className="max-w-[100px] truncate">{img.name}</span>
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() => setImages(prev => prev.filter((_, i) => i !== idx))}
                        className="ml-[4px] hover:text-[var(--color-brand-orange)] transition-colors cursor-pointer"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between items-center px-[24px] py-[16px] border-t border-[var(--color-brand-border)] bg-[var(--color-brand-cream)]">
                <div className="flex items-center gap-[16px]">
                  <label aria-label="Attach document" title="Add Document" className="text-[var(--color-brand-dark)] hover:text-[var(--color-brand-orange)] transition-colors cursor-pointer flex items-center justify-center">
                    <PlusIcon />
                    <input type="file" accept=".pdf,.docx,.txt,.md" className="hidden" onChange={(e) => { const selected = e.target.files?.[0] || null; setFile(selected); e.target.value = ''; }} />
                  </label>
                  <label aria-label="Attach images" title="Add Images" className="text-[var(--color-brand-dark)] hover:text-[var(--color-brand-orange)] transition-colors cursor-pointer flex items-center justify-center">
                    <ImageIcon />
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={(e) => { const selected = Array.from(e.target.files || []); if (images.length + selected.length > 8) { alert("Max 8 images."); return; } setImages(prev => [...prev, ...selected]); e.target.value = ''; }} />
                  </label>
                  {!isGenerating && (
                    <button type="button" onClick={handleMicClick} aria-label="Voice input" className="text-[var(--color-brand-dark)] hover:text-[var(--color-brand-orange)] transition-colors hidden sm:block cursor-pointer">
                      <MicIcon isListening={isListening} />
                    </button>
                  )}
                </div>
                
                <div className="flex items-center gap-[16px]">
                  {/* Theme Picker */}
                  <div className="flex items-center gap-[8px]">
                    <button type="button" aria-label="Default Theme" onClick={() => setTheme('default')} className={`w-[16px] h-[16px] rounded-full bg-[#C05A35] ${theme === 'default' ? 'ring-2 ring-offset-2 ring-[var(--color-brand-dark)]' : ''}`} />
                    <button type="button" aria-label="Ocean Theme" onClick={() => setTheme('ocean')} className={`w-[16px] h-[16px] rounded-full bg-[#4B89D4] ${theme === 'ocean' ? 'ring-2 ring-offset-2 ring-[var(--color-brand-dark)]' : ''}`} />
                    <button type="button" aria-label="Forest Theme" onClick={() => setTheme('forest')} className={`w-[16px] h-[16px] rounded-full bg-[#6A8D68] ${theme === 'forest' ? 'ring-2 ring-offset-2 ring-[var(--color-brand-dark)]' : ''}`} />
                  </div>

                  <div className="relative group">
                    <select 
                      value={model} 
                      onChange={(e) => setModel(e.target.value as any)}
                      disabled={isGenerating}
                      className="appearance-none bg-transparent text-[var(--color-brand-dark)] font-medium text-[14px] outline-none cursor-pointer pr-[24px] border-b border-transparent hover:border-[var(--color-brand-dark)] transition-colors rounded-none"
                    >
                      <option value="gemini-flash-lite">Gemini Flash</option>
                      <option value="gemini-2.5">Gemini 2.5</option>
                      <option value="nvidia">NVIDIA 3.1</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-[var(--color-brand-dark)]">
                      <svg className="fill-current h-[12px] w-[12px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                  </div>
                  
                  {isGenerating ? (
                    <button 
                      type="button"
                      onClick={handleCancel}
                      className="px-[16px] py-[8px] text-[14px] font-bold border border-[var(--color-brand-border)] bg-white text-[var(--color-brand-dark)] hover:bg-[var(--color-brand-cream)] transition-colors"
                    >
                      Cancel
                    </button>
                  ) : (
                    <button 
                      type="submit"
                      aria-label="Generate presentation"
                      disabled={!topic.trim()}
                      className={`px-[24px] py-[8px] text-[14px] font-bold transition-colors ${
                        !topic.trim() 
                          ? 'bg-[var(--color-brand-border)] text-[var(--color-brand-cream)] cursor-not-allowed' 
                          : 'bg-[var(--color-brand-dark)] text-white hover:bg-[var(--color-brand-orange)]'
                      }`}
                    >
                      Generate
                    </button>
                  )}
                </div>
              </div>
            </form>
            
            {error && (
              <p className="text-[var(--color-brand-orange)] mt-[16px] text-[14px] font-medium">{error}</p>
            )}
          </div>
          
          {/* Right Column: Previews, Loader, Download */}
          <div className="flex-1 flex flex-col justify-center items-start lg:items-center min-h-[400px] lg:border-l lg:border-[var(--color-brand-border)] lg:pl-[64px]">
            {isGenerating ? (
              <div className="w-full flex flex-col items-center justify-center p-[32px] border border-[var(--color-brand-border)] bg-white">
                <AnimatedLoader steps={loadingSteps} currentStep={loadingStep} />
                {currentSlide > 0 && totalSlides > 0 && (
                  <p className="text-[12px] font-bold text-[var(--color-brand-dark)] mt-[24px] tracking-widest uppercase">
                    Rendering slide {currentSlide} of {totalSlides}
                  </p>
                )}
              </div>
            ) : downloadUrl ? (
              <div className="w-full flex flex-col items-center border border-[var(--color-brand-border)] bg-white p-[32px]">
                {previewImages.length > 0 && (
                  <div className="w-full mb-[32px]">
                    <p className="text-[14px] font-bold mb-[16px] text-left">Slide Previews</p>
                    <div className="flex overflow-x-auto gap-[16px] pb-[16px] preview-strip">
                      {previewImages.map((src, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => setLightboxImage(src)}
                          className="flex-shrink-0 cursor-pointer group bg-[var(--color-brand-cream)] border border-[var(--color-brand-border)] hover:border-[var(--color-brand-orange)] transition-colors"
                        >
                          <img src={src} alt={`Slide ${idx + 1}`} className="h-[120px] object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {previewImages.length === 0 && generatedSlides.length > 0 && (
                  <div className="w-full mb-[32px]">
                    <p className="text-[14px] font-bold mb-[16px] text-left">Slide Previews</p>
                    <div className="flex flex-col items-center gap-[24px] pb-[16px] preview-strip">
                      {generatedSlides.map((slide, idx) => (
                        <div key={idx} className="relative group w-full flex justify-center">
                          {renderCSSSlide(slide, idx, 0.35, true)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <a 
                  href={downloadUrl.url} 
                  download={downloadUrl.filename}
                  className="w-full text-center px-[32px] py-[16px] bg-[var(--color-brand-dark)] text-white font-bold text-[16px] hover:bg-[var(--color-brand-orange)] transition-colors flex justify-center items-center gap-[8px]"
                >
                  <svg className="w-[20px] h-[20px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  Download .pptx
                </a>
              </div>
            ) : (
              <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center border border-dashed border-[var(--color-brand-border)] bg-[var(--color-brand-cream)] opacity-50">
                <p className="text-[14px] font-bold text-[var(--color-brand-warm)]">Awaiting output...</p>
              </div>
            )}
          </div>

        </div>

        {/* Editorial Section replacing the 3-column feature grid */}
        <div className="max-w-[1200px] mx-auto mt-[120px] pt-[64px] border-t border-[var(--color-brand-border)] flex flex-col lg:flex-row gap-[64px] items-center">
          <div className="flex-1">
            <h3 className="text-[32px] font-bold mb-[24px]" style={{ fontFamily: 'Georgia, serif' }}>
              Every deck exports as a fully editable .pptx file.
            </h3>
            <p className="text-[18px] text-[var(--color-brand-warm)] leading-[1.6]">
              The layout engine maps your topic to themed slide templates, complete with native shapes and typography. No locked-in web editors—just a standard PowerPoint file you can edit offline.
            </p>
          </div>
          <div className="flex-1 flex gap-[24px] overflow-hidden justify-end w-full lg:w-auto">
            {/* Mock slide images using strict CSS borders to simulate preview thumbnails */}
            <div className="w-[280px] h-[157px] bg-white border border-[var(--color-brand-border)] flex-shrink-0 flex flex-col p-[16px]">
              <div className="w-[40%] h-[12px] bg-[var(--color-brand-orange)] mb-[16px]"></div>
              <div className="w-[80%] h-[8px] bg-[var(--color-brand-card)] mb-[8px]"></div>
              <div className="w-[70%] h-[8px] bg-[var(--color-brand-card)] mb-[8px]"></div>
              <div className="w-[85%] h-[8px] bg-[var(--color-brand-card)] mb-[24px]"></div>
              <div className="flex-1 bg-[var(--color-brand-cream)] border border-[var(--color-brand-border)] mt-auto"></div>
            </div>
            <div className="w-[280px] h-[157px] bg-white border border-[var(--color-brand-border)] flex-shrink-0 flex flex-col p-[16px]">
              <div className="w-[60%] h-[12px] bg-[var(--color-brand-dark)] mb-[24px]"></div>
              <div className="flex gap-[16px] h-full">
                <div className="flex-1 bg-[var(--color-brand-cream)] border border-[var(--color-brand-border)]"></div>
                <div className="flex-1 bg-[var(--color-brand-cream)] border border-[var(--color-brand-border)]"></div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="px-[48px] py-[24px] text-[12px] text-[var(--color-brand-warm)] border-t border-[var(--color-brand-border)]">
        &copy; {new Date().getFullYear()} Deckora Inc.
      </footer>
    </div>
  );
}
