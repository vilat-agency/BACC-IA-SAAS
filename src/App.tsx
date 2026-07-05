import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import { PenTool, Send, Loader2, RefreshCw, Download, Upload, X, History, Maximize2, Minimize2, LogOut, Trash2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { HandwritingLoader } from './components/HandwritingLoader';
import { AuthScreen } from './components/AuthScreen';
import { useAuth } from './context/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function extractSvgs(text: string): string[] {
  if (!text) return [];
  const svgs: string[] = [];
  const regex = /<svg[\s\S]*?<\/svg>/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    svgs.push(match[0]);
  }
  return svgs;
}

function cleanSvgCode(svgCode: string): string {
  if (!svgCode) return "";
  
  // Remove backslashes or escaping that might have leaked from markdown parsing
  let cleaned = svgCode.replace(/\\/g, "");
  
  // Define custom styles to prevent black block fills and handle backgrounds
  const styleTag = `
    <style>
      svg {
        background: transparent !important;
      }
      /* Prevent default black fill on paths, lines, and polylines if they have strokes */
      path:not([fill]), 
      polyline:not([fill]), 
      polygon:not([fill]), 
      line:not([fill]) {
        fill: none !important;
      }
      /* Avoid solid black block overlays for plots/curves that have stroke */
      path[fill="black"]:not([stroke="none"]),
      path[fill="#000"]:not([stroke="none"]),
      path[fill="#000000"]:not([stroke="none"]) {
        fill: none !important;
      }
      /* Make sure background rects don't block the millimeter paper */
      rect[fill="#ffffff"], rect[fill="white"] {
        fill: none !important;
      }
      /* Use a beautiful student ink/handwriting font for any text labels */
      text {
        font-family: 'Patrick Hand', 'Inter', sans-serif !important;
      }
    </style>
  `;
  
  const svgIndex = cleaned.toLowerCase().indexOf("<svg");
  if (svgIndex !== -1) {
    const closingBracketIndex = cleaned.indexOf(">", svgIndex);
    if (closingBracketIndex !== -1) {
      cleaned = cleaned.slice(0, closingBracketIndex + 1) + styleTag + cleaned.slice(closingBracketIndex + 1);
    }
  }
  return cleaned;
}

const SUBJECTS = [
  "Mathématiques",
  "Physique-Chimie",
  "Philosophie",
  "Sciences de la Vie et de la Terre",
  "Histoire-Géographie",
  "Spécialité NSI"
];

const MATH_SYMBOLS = ["x²", "x³", "ⁿ", "√", "π", "∑", "∫", "∞", "≠", "≤", "≥", "α", "β", "θ", "Δ", "½"];

type HistoryItem = { id: string; subject: string; problem: string; result: string; date: Date };

function ExamWorkspace() {
  const { user, logout, authFetch } = useAuth();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [problem, setProblem] = useState("");
  const [file, setFile] = useState<{name: string, data: string, mimeType: string} | null>(null);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [paperStyle, setPaperStyle] = useState<'lignes' | 'millimetre'>('lignes');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const svgs = extractSvgs(result);

  // Charge l'historique persisté (MongoDB) au chargement de l'espace de travail.
  React.useEffect(() => {
    let cancelled = false;
    async function loadHistory() {
      setIsHistoryLoading(true);
      try {
        const res = await authFetch("/api/history");
        const data = await res.json();
        if (!cancelled && res.ok) {
          setHistory(
            (data.items || []).map((item: any) => ({
              id: item._id,
              subject: item.subject,
              problem: item.problem,
              result: item.result,
              date: new Date(item.createdAt),
            }))
          );
        }
      } catch {
        // Silencieux : l'historique n'est pas critique pour utiliser l'app.
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [authFetch]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setTimeElapsed(0);
      interval = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setTimeElapsed(0);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!problem.trim() && !file) return;

    setIsLoading(true);
    setError("");
    setResult("");

    try {
      const payload: any = { subject, problem };
      if (file) {
        payload.fileData = file.data;
        payload.fileMimeType = file.mimeType;
      }

      const res = await authFetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Une erreur est survenue.");
      }

      setResult(data.result);

      const problemLabel = problem || (file ? `Fichier: ${file.name}` : "");
      // Sauvegarde persistante dans MongoDB, liée au compte connecté.
      try {
        const saveRes = await authFetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, problem: problemLabel, result: data.result }),
        });
        const saveData = await saveRes.json();
        if (saveRes.ok) {
          setHistory(prev => [{
            id: saveData.item._id,
            subject,
            problem: problemLabel,
            result: data.result,
            date: new Date(saveData.item.createdAt),
          }, ...prev]);
        }
      } catch {
        // La copie reste affichée même si la sauvegarde de l'historique échoue.
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteHistoryItem = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    try {
      await authFetch(`/api/history/${id}`, { method: "DELETE" });
    } catch {
      // Pas bloquant : l'élément reste retiré de l'affichage local.
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const base64Data = base64Url.split(',')[1];
      setFile({
        name: selected.name,
        data: base64Data,
        mimeType: selected.type
      });
    };
    reader.readAsDataURL(selected);
  };

  const insertSymbol = (sym: string) => {
    setProblem(prev => prev + sym);
  };

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setIsExporting(true);
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      
      const parseVal = (val: string, maxVal: number): number => {
        val = val.trim();
        let parsed = 0;
        if (val.endsWith('%')) {
          parsed = (parseFloat(val) / 100) * maxVal;
        } else {
          parsed = parseFloat(val);
        }
        return isNaN(parsed) ? 0 : parsed;
      };

      const oklchToRgb = (oklchStr: string): string => {
        try {
          const cleanStr = oklchStr.trim().toLowerCase();
          if (!cleanStr.startsWith('oklch')) return oklchStr;
          
          const inner = cleanStr.substring(cleanStr.indexOf('(') + 1, cleanStr.lastIndexOf(')'));
          const parts = inner.split('/');
          const colorParts = parts[0].trim().split(/[\s,]+/);
          
          if (colorParts.length < 3) return 'rgb(120, 120, 120)';
          
          const l = parseVal(colorParts[0], 1);
          const c = parseVal(colorParts[1], 1);
          let hStr = colorParts[2];
          if (hStr.endsWith('deg')) hStr = hStr.slice(0, -3);
          else if (hStr.endsWith('rad')) hStr = String((parseFloat(hStr) * 180) / Math.PI);
          else if (hStr.endsWith('turn')) hStr = String(parseFloat(hStr) * 360);
          const h = parseFloat(hStr);
          
          const a = parts[1] !== undefined ? parseVal(parts[1], 1) : 1;
          
          const hRad = (h * Math.PI) / 180;
          const L = l;
          const a_coord = c * Math.cos(hRad);
          const b_coord = c * Math.sin(hRad);

          const l_lms = L + 0.3963377774 * a_coord + 0.2158037573 * b_coord;
          const m_lms = L - 0.1055613458 * a_coord - 0.0638541728 * b_coord;
          const s_lms = L - 0.0894841775 * a_coord - 1.2914855480 * b_coord;

          const l_lin = Math.pow(l_lms, 3);
          const m_lin = Math.pow(m_lms, 3);
          const s_lin = Math.pow(s_lms, 3);

          const r_lin = +4.0767416621 * l_lin - 3.3077115913 * m_lin + 0.2309699292 * s_lin;
          const g_lin = -1.2684380046 * l_lin + 2.6097574011 * m_lin - 0.3413193965 * s_lin;
          const b_lin = -0.0041960863 * l_lin - 0.7034186147 * m_lin + 1.7076147010 * s_lin;

          const toSRGB = (x: number) => {
            if (isNaN(x) || x <= 0) return 0;
            if (x >= 1) return 255;
            return Math.round((x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255);
          };

          const r = toSRGB(r_lin);
          const g = toSRGB(g_lin);
          const b = toSRGB(b_lin);

          if (a === 1) {
            return `rgb(${r}, ${g}, ${b})`;
          } else {
            return `rgba(${r}, ${g}, ${b}, ${a})`;
          }
        } catch (err) {
          console.error("Error converting OKLCH color:", err);
          return 'rgb(120, 120, 120)';
        }
      };

      const replaceOklchWithRgb = (str: string): string => {
        if (!str || typeof str !== 'string') return str;
        if (!str.includes('oklch')) return str;
        return str.replace(/oklch\([^\)]+\)/gi, (match) => oklchToRgb(match));
      };

      const traverseAndConvertColors = (original: HTMLElement, cloned: HTMLElement) => {
        const processSingleElement = (origEl: HTMLElement, cloneEl: HTMLElement) => {
          try {
            const computed = window.getComputedStyle(origEl);
            const COLOR_PROPERTIES = [
              'color',
              'backgroundColor',
              'borderColor',
              'borderTopColor',
              'borderRightColor',
              'borderBottomColor',
              'borderLeftColor',
              'fill',
              'stroke',
              'boxShadow',
              'textShadow',
              'backgroundImage',
              'outlineColor'
            ];
            
            COLOR_PROPERTIES.forEach(prop => {
              const val = computed[prop as any];
              if (val && val.includes('oklch')) {
                cloneEl.style[prop as any] = replaceOklchWithRgb(val);
              }
            });
          } catch (e) {
            console.error("Error processing element styles:", e);
          }
        };

        processSingleElement(original, cloned);

        const origChildren = original.querySelectorAll('*');
        const clonedChildren = cloned.querySelectorAll('*');
        
        const len = Math.min(origChildren.length, clonedChildren.length);
        for (let i = 0; i < len; i++) {
          processSingleElement(origChildren[i] as HTMLElement, clonedChildren[i] as HTMLElement);
        }
      };

      // Temporarily override window.getComputedStyle on the main window
      const originalWindowGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = function (el: Element, pseudo?: string | null) {
        const style = originalWindowGetComputedStyle.call(window, el, pseudo);
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'getPropertyValue') {
              return (name: string) => {
                const val = target.getPropertyValue(name);
                return typeof val === 'string' && val.includes('oklch') ? replaceOklchWithRgb(val) : val;
              };
            }
            const val = Reflect.get(target, prop, receiver);
            if (typeof val === 'string' && val.includes('oklch')) {
              return replaceOklchWithRgb(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };

      let canvas;
      try {
        canvas = await html2canvas(printRef.current, { 
          scale: 2,
          onclone: (clonedDoc) => {
            // Sanitize all style blocks in cloned doc
            clonedDoc.querySelectorAll('style').forEach(styleTag => {
              if (styleTag.textContent && styleTag.textContent.includes('oklch')) {
                styleTag.textContent = replaceOklchWithRgb(styleTag.textContent);
              }
            });

            // Proxy getComputedStyle on cloned doc's default view
            const clonedWin = clonedDoc.defaultView;
            if (clonedWin) {
              const originalClonedGetComputedStyle = clonedWin.getComputedStyle;
              clonedWin.getComputedStyle = function (el: Element, pseudo?: string | null) {
                const style = originalClonedGetComputedStyle.call(clonedWin, el, pseudo);
                return new Proxy(style, {
                  get(target, prop, receiver) {
                    if (prop === 'getPropertyValue') {
                      return (name: string) => {
                        const val = target.getPropertyValue(name);
                        return typeof val === 'string' && val.includes('oklch') ? replaceOklchWithRgb(val) : val;
                      };
                    }
                    const val = Reflect.get(target, prop, receiver);
                    if (typeof val === 'string' && val.includes('oklch')) {
                      return replaceOklchWithRgb(val);
                    }
                    if (typeof val === 'function') {
                      return val.bind(target);
                    }
                    return val;
                  }
                });
              };
            }

            const clonedElement = clonedDoc.getElementById('exam-print-paper');
            if (clonedElement && printRef.current) {
              traverseAndConvertColors(printRef.current, clonedElement as HTMLElement);
            }
          }
        });
      } finally {
        // Restore window.getComputedStyle
        window.getComputedStyle = originalWindowGetComputedStyle;
      }
      const imgData = canvas.toDataURL('image/png');
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pageHeight = Math.floor(imgWidth * 1.414); // Standard A4 aspect ratio
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [imgWidth, pageHeight]
      });
      
      let pageIndex = 0;
      let heightLeft = imgHeight;
      
      while (heightLeft > 0) {
        if (pageIndex > 0) {
          pdf.addPage([imgWidth, pageHeight]);
        }
        const position = -(pageIndex * pageHeight);
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        pageIndex++;
      }
      
      pdf.save(`copie_${subject.toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'exportation PDF");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#e5e7eb] font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#3b82f6] rounded-lg flex items-center justify-center text-white font-bold text-xl">B</div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Bac IA <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded ml-2">Micro-SaaS Terminale</span></h1>
            <p className="text-xs text-gray-500">L'excellence académique assistée par intelligence artificielle</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs font-bold text-gray-900">{user?.name}</p>
            <p className="text-[10px] text-gray-400">{user?.email}</p>
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 uppercase">
            {user?.name?.charAt(0) ?? "?"}
          </div>
          <button
            onClick={logout}
            title="Se déconnecter"
            className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-6 gap-6">
        
        {/* Left Column: Input Form */}
        {!isFullscreen && (
          <section className="w-full lg:w-1/3 flex flex-col gap-4">
            <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col ${(history.length > 0 || isHistoryLoading) ? 'h-2/3' : 'h-full'} overflow-y-auto`}>
              <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                <PenTool className="w-4 h-4 text-blue-500" />
                Énoncé du problème
              </h2>
              
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Matière</label>
                  <select 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg p-2.5 bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all text-sm text-gray-700"
                  >
                    {SUBJECTS.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 flex-1 flex min-h-0">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Énoncé</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                        <Upload className="w-3 h-3" />
                        Joindre un fichier (PDF/Image)
                      </button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileChange} />
                    </div>
                  </div>
                  {file && (
                    <div className="text-xs bg-blue-50 text-blue-700 p-2 rounded flex justify-between items-center">
                      <span className="truncate flex-1 font-medium">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} className="text-blue-500 hover:text-blue-700 ml-2">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1 mb-1">
                    {MATH_SYMBOLS.map(sym => (
                      <button key={sym} type="button" onClick={() => insertSymbol(sym)} className="px-1.5 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 rounded border border-gray-200 text-gray-700 transition-colors">
                        {sym}
                      </button>
                    ))}
                  </div>
                  <textarea 
                    value={problem}
                    onChange={(e) => setProblem(e.target.value)}
                    placeholder="Ex: Soit f la fonction définie sur R par f(x) = x^2 * exp(-x)... ou utilisez le bouton au-dessus pour joindre un sujet complet"
                    className="flex-1 w-full p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm italic text-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400 transition-all min-h-[150px]"
                    required={!file}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={isLoading || (!problem.trim() && !file)}
                  className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Rédaction en cours...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Générer la rédaction
                    </>
                  )}
                </button>

                <button 
                  type="button"
                  onClick={handleExportPDF}
                  disabled={!result || isExporting}
                  className="w-full bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Exporter en PDF
                </button>

                {error && (
                  <div className="mt-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                    {error}
                  </div>
                )}
              </form>
            </div>
            {(history.length > 0 || isHistoryLoading) && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-1/3 overflow-hidden">
                <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 shrink-0">
                  <History className="w-4 h-4 text-blue-500" />
                  Historique
                </h2>
                <div className="flex flex-col gap-2 overflow-y-auto pr-1">
                  {isHistoryLoading ? (
                    <div className="flex items-center justify-center py-6 text-gray-400 gap-2 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Chargement de l'historique...
                    </div>
                  ) : (
                    history.map(item => (
                       <button 
                         key={item.id} 
                         type="button"
                         onClick={() => { setSubject(item.subject); setResult(item.result); setProblem(item.problem.startsWith('Fichier:') ? '' : item.problem); setFile(null); }} 
                         className="text-left p-3 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 hover:border-blue-300 transition-colors w-full focus:outline-none focus:ring-1 focus:ring-blue-400 group relative"
                       >
                         <div className="flex justify-between items-start mb-1 pr-5">
                           <p className="text-xs font-bold text-gray-800">{item.subject}</p>
                           <p className="text-[10px] text-gray-500">{item.date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                         </div>
                         <p className="text-xs text-gray-600 line-clamp-2 italic pr-5">{item.problem}</p>
                         <span
                           role="button"
                           onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                           title="Supprimer"
                           className="absolute top-2.5 right-2.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                         >
                           <Trash2 className="w-3.5 h-3.5" />
                         </span>
                       </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Right Column: The Exam Paper */}
        <section className={cn("relative h-full flex flex-col gap-2 transition-all duration-300", isFullscreen ? "w-full" : "w-full lg:w-2/3")}>
          <div className="flex justify-end gap-2">
            <button 
              onClick={() => setPaperStyle('lignes')}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${paperStyle === 'lignes' ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              Lignes classiques
            </button>
            <button 
              onClick={() => setPaperStyle('millimetre')}
              className={`text-xs px-3 py-1.5 rounded border transition-colors ${paperStyle === 'millimetre' ? 'bg-blue-100 text-blue-700 border-blue-200 font-bold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
            >
              Papier millimétré
            </button>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={cn(
                "text-xs px-3 py-1.5 rounded border transition-all flex items-center gap-1.5 font-semibold shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-400",
                isFullscreen 
                  ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200" 
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              )}
              title={isFullscreen ? "Quitter le mode plein écran" : "Passer en mode plein écran"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-green-600" />
                  Quitter plein écran
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                  Plein écran
                </>
              )}
            </button>
          </div>
          <div 
            className="flex-1 bg-[#fefefe] shadow-lg rounded-sm border border-gray-300 flex flex-col overflow-y-auto relative" 
          >
            <div id="exam-print-paper" ref={printRef} className={cn("flex flex-col min-h-full bg-[#fefefe] relative", paperStyle === 'millimetre' && "millimeter-paper")} style={paperStyle === 'lignes' ? { backgroundImage: 'linear-gradient(#e5f3ff 1px, transparent 1px)', backgroundSize: '100% 36px' } : undefined}>
              
              {/* Academic Watermark / Filigrane */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden flex flex-col justify-around items-center opacity-[0.035] select-none z-0 print:opacity-[0.05]">
                <div className="text-[6vw] font-black uppercase tracking-[15px] transform -rotate-[35deg] font-sans text-red-950 whitespace-nowrap">
                  EXEMPLAIRE D'ENTRAÎNEMENT
                </div>
                <div className="text-[6vw] font-black uppercase tracking-[15px] transform -rotate-[35deg] font-sans text-red-950 whitespace-nowrap">
                  BROUILLON - BAC BLANC
                </div>
                <div className="text-[6vw] font-black uppercase tracking-[15px] transform -rotate-[35deg] font-sans text-red-950 whitespace-nowrap">
                  EXEMPLAIRE D'ENTRAÎNEMENT
                </div>
                <div className="text-[6vw] font-black uppercase tracking-[15px] transform -rotate-[35deg] font-sans text-red-950 whitespace-nowrap">
                  BROUILLON - BAC BLANC
                </div>
                <div className="text-[6vw] font-black uppercase tracking-[15px] transform -rotate-[35deg] font-sans text-red-950 whitespace-nowrap">
                  EXEMPLAIRE D'ENTRAÎNEMENT
                </div>
              </div>

              {/* Header of the exam paper */}
              <div className="w-full h-12 bg-white border-b border-gray-300 flex items-center px-4 justify-between z-10 shrink-0">
                <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">République Française - Baccalauréat Général</span>
                <span className="text-[10px] text-gray-400 italic">Épreuve de {subject}</span>
              </div>

              {/* Body of the exam paper */}
              <div className="flex-1 relative z-10">
                {paperStyle === 'millimetre' ? (
                  /* EXCLUSIVELY GRAPHICS/SVGs ON MILLIMETER PAPER */
                  <div className="min-h-full p-12 flex flex-col gap-8">
                    <div className="border-b border-red-200 pb-4 mb-4">
                      <h2 className="text-xl font-bold font-sans text-red-800 uppercase tracking-wider flex items-center gap-2">
                        <span>Annexe : Représentations Graphiques</span>
                        <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded normal-case font-normal">Papier Millimétré</span>
                      </h2>
                      <p className="text-xs text-gray-500 font-sans mt-1">
                        Cette feuille de papier millimétré contient uniquement les tracés, courbes ou figures demandés.
                      </p>
                    </div>
                    
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
                        <RefreshCw className="h-8 w-8 animate-spin text-red-500" />
                        <p className="italic font-sans">Génération des tracés géométriques...</p>
                      </div>
                    ) : svgs.length > 0 ? (
                      <div className="flex flex-col gap-12 items-center">
                        {svgs.map((svgCode, idx) => (
                          <div key={idx} className="w-full max-w-3xl border border-red-200/40 p-6 rounded-lg backdrop-blur-[1px] bg-white/10 shadow-inner flex flex-col gap-4">
                            <h3 className="font-handwriting text-2xl text-red-900 underline">
                              Figure {idx + 1} : Tracé de la courbe ou figure géométrique
                            </h3>
                            <div 
                              className="flex justify-center items-center overflow-x-auto w-full"
                              dangerouslySetInnerHTML={{ __html: cleanSvgCode(svgCode) }}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                        <PenTool className="h-12 w-12 text-red-300 opacity-40 animate-pulse" />
                        <p className="font-handwriting text-2xl text-gray-500">Le papier millimétré reste vierge.</p>
                        <p className="text-xs text-gray-400 max-w-sm font-sans">
                          Aucun tracé de fonction ou figure géométrique n'est généré pour ce sujet. Veuillez consulter la copie double rédigée sur les lignes classiques.
                        </p>
                        <button
                          onClick={() => setPaperStyle('lignes')}
                          className="mt-4 text-xs px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-sans font-semibold transition-colors shadow"
                        >
                          Afficher la Copie Double (Lignes classiques)
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* NORMAL COPIE DOUBLE WRITTEN COPY */
                  <div className="min-h-full flex border-l-[3px] border-[#ffb3b3] ml-20 relative pt-12 pb-8 px-12">
                    <div className="absolute left-[-60px] top-14 transform -rotate-90 text-[10px] font-bold text-[#ffb3b3] uppercase tracking-widest">
                      Marge de correction
                    </div>
                    
                    <div className="w-full font-serif text-gray-800 text-[15px]">
                      {isLoading ? (
                        <HandwritingLoader timeElapsed={timeElapsed} />
                      ) : result ? (
                        <div className="markdown-body font-handwriting text-lg text-gray-800 leading-relaxed">
                          <ReactMarkdown 
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              code({ node, inline, className, children, ...props }: any) {
                                const match = /language-(\w+)/.exec(className || "");
                                if (!inline && match && (match[1] === "xml" || match[1] === "svg" || match[1] === "html")) {
                                  const codeString = String(children).replace(/\n$/, "");
                                  if (codeString.trim().startsWith("<svg")) {
                                    return (
                                      <div className="my-8 border border-red-200 rounded-lg shadow-sm overflow-hidden bg-white max-w-full print:break-inside-avoid">
                                        <div className="bg-red-50 px-3 py-1.5 border-b border-red-100 text-[11px] font-sans font-bold uppercase tracking-wider text-red-700 flex justify-between items-center">
                                          <span className="flex items-center gap-1">
                                            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                                            Document Joint : Tracé sur Papier Millimétré
                                          </span>
                                          <span className="text-[9px] bg-red-100 px-1.5 py-0.5 rounded text-red-800">Graphique</span>
                                        </div>
                                        <div 
                                          className="millimeter-paper p-6 flex justify-center items-center w-full overflow-x-auto" 
                                          dangerouslySetInnerHTML={{ __html: cleanSvgCode(codeString) }} 
                                        />
                                      </div>
                                    );
                                  }
                                }
                                return (
                                  <code className={className} {...props}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {result}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-64 text-gray-300 gap-4">
                          <PenTool className="h-12 w-12 opacity-20" />
                          <p className="italic text-gray-400">La copie est vierge.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}

export default function App() {
  const { user, isReady } = useAuth();

  if (!isReady) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#e5e7eb]">
        <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <ExamWorkspace />;
}
