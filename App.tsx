
import React, { useState, useRef, useEffect } from 'react';
import { 
  Languages, 
  Upload, 
  Link as LinkIcon, 
  FileText, 
  Copy, 
  Download, 
  ChevronRight, 
  Loader2, 
  Trash2, 
  BookOpen, 
  Globe, 
  RefreshCw, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Settings2, 
  FileJson, 
  FileCode, 
  FilePlus2, 
  ChevronDown, 
  ExternalLink, 
  Flag, 
  Wand2, 
  Sparkles, 
  Link2, 
  Info, 
  ShieldAlert,
  Printer,
  Book,
  FileBox,
  ClipboardList,
  Eraser
} from 'lucide-react';
import { translateNovel } from './services/geminiService';
import { TranslationResult, InputMode, TranslationState, NovelGenre, NovelStyle, SourceLanguage } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<InputMode>(InputMode.TEXT);
  const [sourceLang, setSourceLang] = useState<SourceLanguage>('CN');
  const [genre, setGenre] = useState<NovelGenre>('Tự động nhận diện');
  const [style, setStyle] = useState<NovelStyle>('Tự động nhận diện');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showUrlPanel, setShowUrlPanel] = useState(false);
  
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const [state, setState] = useState<TranslationState & { isFetching: boolean; lastInput: string | { data: string; mimeType: string }; isImage: boolean }>({
    isTranslating: false,
    isFetching: false,
    error: null,
    result: null,
    sourceText: '',
    lastInput: '',
    isImage: false
  });
  
  const [url, setUrl] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [fetchSuccess, setFetchSuccess] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const GENRES: NovelGenre[] = ['Tự động nhận diện', 'Tu Tiên', 'Kiếm Hiệp', 'Huyền Huyễn', 'Ngôn Tình', 'Đô Thị', 'Fantasy', 'Sci-Fi', 'Kinh Dị'];
  const STYLES: NovelStyle[] = ['Tự động nhận diện', 'Cổ Phong', 'Hiện Đại', 'Hài Hước', 'Trang Trọng'];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const cleanHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const garbage = doc.querySelectorAll('script, style, nav, footer, header, ads, iframe, .ads, #ads, .sidebar, .related, .comment, .social, .breadcrumb, .hidden, [style*="display:none"], .copyright, .watermark, .post-navigation, .app-ads');
    garbage.forEach(s => s.remove());
    
    const selectors = [
      '#chapter-c', '.chapter-c', '.box-chap', '#chapter-content-box', '.chuong-noi-dung', '.content-server-1', '.content-server-2', '.js-chapter-content', '.reading-detail', '#js-reading-content', '.chapter-detail-content', '.chapter-content', '.content-text',
      'article', '.content', '#content', '.read-content', '.post-content', '.novel-content', '.txtnav'
    ];
    
    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      if (element) {
        element.querySelectorAll('div, ins, blockquote, font').forEach(el => {
            const text = el.textContent || '';
            if (text.length < 100 && (text.includes('http') || text.includes('ads') || text.includes('truyện') || text.includes('.com') || text.includes('.vn'))) {
                el.remove();
            }
        });
        element.querySelectorAll('a').forEach(a => a.remove());
        return element.textContent?.trim() || '';
      }
    }
    
    const bodyText = Array.from(doc.body.querySelectorAll('p, div'))
      .map(el => el.textContent?.trim() || '')
      .filter(text => text.length > 50)
      .join('\n\n');

    return bodyText || doc.body.textContent?.trim() || '';
  };

  const handleFetchUrl = async () => {
    let targetUrl = url.trim();
    if (!targetUrl) return;
    if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
        setUrl(targetUrl);
    }

    setState(prev => ({ ...prev, isFetching: true, error: null, result: null }));
    setFetchSuccess(false);
    
    const proxies = [
        `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}&timestamp=${Date.now()}`,
        `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`,
        `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`
    ];

    let fetchedContent = "";
    let success = false;

    for (const proxyUrl of proxies) {
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) continue;
            if (proxyUrl.includes('allorigins')) {
                const data = await response.json();
                fetchedContent = data.contents;
            } else {
                fetchedContent = await response.text();
            }
            if (fetchedContent && fetchedContent.length > 200) {
                success = true;
                break;
            }
        } catch (e) { continue; }
    }

    if (success) {
      const cleanedText = fetchedContent.includes('<') ? cleanHtml(fetchedContent) : fetchedContent;
      setState(prev => ({ ...prev, sourceText: cleanedText, isFetching: false }));
      const isVNPage = targetUrl.includes('.vn') || targetUrl.includes('truyenfull') || targetUrl.includes('tangthuvien') || targetUrl.includes('metruyenchu') || targetUrl.includes('wikidich');
      if (isVNPage) setMode(InputMode.HAN_VIET);
      else setMode(InputMode.TEXT);
      setFetchSuccess(true);
      setShowUrlPanel(false);
      setTimeout(() => setFetchSuccess(false), 3000);
    } else {
      setState(prev => ({ ...prev, isFetching: false, error: "Không thể lấy nội dung tự động. Trang web này có thể đang sử dụng bảo mật Cloudflare. Vui lòng Copy-Paste thủ công." }));
    }
  };

  const handleTranslate = async (inputToTranslate?: string | { data: string; mimeType: string }, isImageInput: boolean = false, instruction: string = "") => {
    const input = inputToTranslate || state.sourceText;
    if (!input && !isImageInput) return;
    setState(prev => ({ ...prev, isTranslating: true, error: null, lastInput: input, isImage: isImageInput }));
    setProgress({ current: 0, total: 0 });
    
    try {
      const translation = await translateNovel(
        input, 
        sourceLang, 
        isImageInput, 
        instruction, 
        genre, 
        style, 
        mode === InputMode.HAN_VIET,
        (curr, tot) => setProgress({ current: curr, total: tot })
      );
      setState(prev => ({ ...prev, result: translation, isTranslating: false }));
      setShowRefineInput(false);
      setCustomPrompt('');
      setTimeout(() => { document.getElementById('translation-result')?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    } catch (err: any) {
      setState(prev => ({ ...prev, error: err.message, isTranslating: false }));
    }
  };

  const handleRetranslate = () => handleTranslate(state.lastInput, state.isImage, customPrompt);

  const startNewTranslation = () => {
    setState({
      isTranslating: false,
      isFetching: false,
      error: null,
      result: null,
      sourceText: '',
      lastInput: '',
      isImage: false
    });
    setUrl('');
    setCustomPrompt('');
    setShowRefineInput(false);
    setProgress({ current: 0, total: 0 });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(type);
    setTimeout(() => setCopyFeedback(null), 2000);
  };

  const downloadFile = (format: string) => {
    if (!state.result) return;
    let content = "";
    let mimeType = "text/plain";
    const title = state.result.title || "Tên truyện";
    const chapter = state.result.chapterNumber || "Chương mới";
    const name = state.result.chapterName || "Đang cập nhật";
    let filename = `${title.substring(0, 20)}_${chapter.replace(/\s+/g, '_')}.${format}`;
    const header = `${title}\n${chapter} ${name}\n\n`;

    switch(format) {
      case 'txt':
        content = header + state.result.content;
        break;
      case 'doc':
      case 'docx':
        mimeType = "application/msword";
        filename = `${title.substring(0, 20)}_${chapter.replace(/\s+/g, '_')}.${format}`;
        content = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'><title>${title}</title></head>
          <body style="font-family: 'Times New Roman', serif; line-height: 1.6;">
            <h1 style="text-align:center;">${title}</h1>
            <h2 style="text-align:center;">${chapter}: ${name}</h2>
            <div style="white-space: pre-wrap; font-size: 14pt;">${state.result.content}</div>
          </body>
          </html>`;
        break;
      case 'md':
        content = `# ${title}\n## ${chapter}: ${name}\n\n${state.result.content}`;
        break;
      case 'html':
        mimeType = "text/html";
        content = `<html><head><meta charset="utf-8"><title>${title} - ${chapter}</title><style>body{font-family:serif;max-width:800px;margin:auto;padding:2rem;line-height:1.8;background:#fcf9f2;color:#334155;}h1,h2{text-align:center;}</style></head><body><h1>${title}</h1><h2>${chapter} ${name}</h2><div style="white-space: pre-wrap; font-size: 1.25rem;">${state.result.content}</div></body></html>`;
        break;
      case 'json':
        mimeType = "application/json";
        content = JSON.stringify(state.result, null, 2);
        break;
      case 'print':
        window.print();
        return;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm print:hidden">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-2 rounded-lg shadow-lg shadow-red-100">
              <Languages className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg md:text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
              Dịch Truyện AI
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={startNewTranslation}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:text-red-600 font-bold transition-colors text-sm rounded-lg hover:bg-red-50"
            >
              <FilePlus2 className="w-4 h-4" />
              <span className="hidden sm:inline">Dịch bản mới</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full p-3 md:p-6 flex flex-col gap-4 md:gap-6 print:p-0">
        
        {/* Settings Panel */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-6 print:hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Flag className="w-3 h-3" /> Ngôn ngữ nguồn
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setSourceLang('CN')}
                  disabled={mode === InputMode.HAN_VIET}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${sourceLang === 'CN' ? 'bg-red-600 border-red-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-red-300'} ${mode === InputMode.HAN_VIET ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  🇨🇳 Tiếng Trung
                </button>
                <button
                  onClick={() => setSourceLang('EN')}
                  disabled={mode === InputMode.HAN_VIET}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2 ${sourceLang === 'EN' ? 'bg-blue-600 border-blue-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-300'} ${mode === InputMode.HAN_VIET ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  🇺🇸 Tiếng Anh
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Settings2 className="w-3 h-3" /> Thể loại
              </label>
              <div className="flex flex-wrap gap-1.5">
                {GENRES.slice(0, 5).map(g => (
                  <button
                    key={g}
                    onClick={() => setGenre(g)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${genre === g ? 'bg-slate-800 border-slate-800 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-800'}`}
                  >
                    {g}
                  </button>
                ))}
                <select 
                  className="px-2 py-1.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-500 outline-none"
                  onChange={(e) => setGenre(e.target.value as NovelGenre)}
                  value={GENRES.includes(genre) ? genre : "Tự động nhận diện"}
                >
                  <option disabled>Thể loại khác</option>
                  {GENRES.slice(5).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Văn phong
              </label>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStyle(s)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${style === s ? 'bg-slate-800 border-slate-800 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-800'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Input Area */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col transition-all print:hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button onClick={() => setMode(InputMode.TEXT)} className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${mode === InputMode.TEXT ? 'text-red-600 border-b-2 border-red-600 bg-white' : 'text-slate-500 hover:text-slate-800'}`}><FileText className="w-4 h-4" /> Dịch Text</button>
            <button onClick={() => setMode(InputMode.HAN_VIET)} className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${mode === InputMode.HAN_VIET ? 'text-amber-600 border-b-2 border-amber-600 bg-white' : 'text-slate-500 hover:text-slate-800'}`}><Wand2 className="w-4 h-4" /> Sửa Hán Việt</button>
            <button onClick={() => setMode(InputMode.URL)} className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${mode === InputMode.URL ? 'text-blue-600 border-b-2 border-blue-600 bg-white' : 'text-slate-500 hover:text-slate-800'}`}><Globe className="w-4 h-4" /> Lấy URL</button>
            <button onClick={() => setMode(InputMode.FILE)} className={`flex-1 py-4 flex items-center justify-center gap-2 text-sm font-bold transition-all ${mode === InputMode.FILE ? 'text-slate-900 border-b-2 border-slate-900 bg-white' : 'text-slate-500 hover:text-slate-800'}`}><Upload className="w-4 h-4" /> File/Ảnh</button>
          </div>

          <div className="p-4 md:p-6 relative">
            {fetchSuccess && (
                <div className="mb-4 bg-emerald-50 border border-emerald-100 text-emerald-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
                    <CheckCircle2 className="w-4 h-4" /> Đã trích xuất văn bản từ URL!
                </div>
            )}

            {(mode === InputMode.TEXT || mode === InputMode.HAN_VIET) && (
              <div className="relative group min-h-[300px]">
                {/* TOOLBAR FOR SOURCE TEXT */}
                <div className="flex items-center justify-between gap-2 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => setShowUrlPanel(!showUrlPanel)}
                      className={`flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${showUrlPanel ? 'border-blue-500 text-blue-600' : 'border-slate-200 text-slate-500 hover:text-red-600'}`}
                    >
                      <Link2 className="w-3.5 h-3.5" /> {showUrlPanel ? "Đóng" : "Dán link lấy text"}
                    </button>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {state.sourceText && (
                      <button 
                        onClick={() => copyToClipboard(state.sourceText, 'source')} 
                        className={`flex items-center gap-1.5 px-3 py-2 bg-white border rounded-lg text-[10px] font-black uppercase transition-all shadow-sm ${copyFeedback === 'source' ? 'border-emerald-500 text-emerald-600' : 'border-slate-200 text-slate-500 hover:text-red-600'}`}
                      >
                        {copyFeedback === 'source' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} 
                        {copyFeedback === 'source' ? "Đã copy" : "Copy nguồn"}
                      </button>
                    )}
                    {state.sourceText && (
                      <button 
                        onClick={() => setState(prev => ({ ...prev, sourceText: '' }))} 
                        className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:text-red-500 transition-all shadow-sm"
                      >
                        <Eraser className="w-3.5 h-3.5" /> Xóa
                      </button>
                    )}
                  </div>
                </div>

                {showUrlPanel && (
                  <div className="absolute top-14 left-0 right-0 z-20 bg-white border border-slate-200 p-4 rounded-xl shadow-2xl animate-in slide-in-from-top-2 flex flex-col gap-3 mx-2">
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        value={url} 
                        onChange={(e) => setUrl(e.target.value)} 
                        placeholder="Dán link chương truyện..." 
                        className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-4 focus:ring-blue-50 outline-none"
                      />
                      <button 
                        onClick={handleFetchUrl}
                        disabled={state.isFetching}
                        className="px-5 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {state.isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Lấy Nội Dung"}
                      </button>
                    </div>
                  </div>
                )}

                <textarea
                  value={state.sourceText}
                  onChange={(e) => setState(prev => ({ ...prev, sourceText: e.target.value }))}
                  placeholder={mode === InputMode.HAN_VIET ? "Dán văn bản convert..." : `Dán văn bản nguồn tại đây...`}
                  className={`w-full h-64 md:h-96 p-6 text-base md:text-lg border rounded-2xl focus:ring-4 outline-none transition-all resize-none novel-font bg-slate-50/20 ${mode === InputMode.HAN_VIET ? 'border-amber-200 focus:border-amber-400' : 'border-slate-200 focus:border-red-400'}`}
                />
              </div>
            )}

            {mode === InputMode.URL && (
              <div className="flex flex-col gap-6 py-10 md:py-20 items-center justify-center min-h-[300px]">
                <div className="w-full max-w-xl flex flex-col gap-4">
                  <div className="relative">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full pl-12 pr-4 py-4 border border-slate-200 rounded-2xl outline-none" />
                  </div>
                  <button onClick={handleFetchUrl} disabled={state.isFetching} className="w-full bg-blue-600 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-xl disabled:opacity-50">
                    {state.isFetching ? <Loader2 className="w-6 h-6 animate-spin" /> : "Quét Nội Dung Truyện"}
                  </button>
                </div>
              </div>
            )}

            {mode === InputMode.FILE && (
              <div onClick={() => fileInputRef.current?.click()} className="w-full h-64 md:h-96 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-4 hover:border-red-300 hover:bg-red-50 transition-all cursor-pointer group">
                <div className="p-6 bg-slate-50 rounded-full group-hover:scale-110 transition-transform"><Upload className="w-10 h-10 text-slate-400 group-hover:text-red-600" /></div>
                <div className="text-center px-6"><p className="font-bold text-slate-700">Tải lên file văn bản hoặc ảnh</p><p className="text-xs text-slate-400 mt-2">Hỗ trợ .txt hoặc ảnh truyện để OCR</p></div>
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  if (file.type.startsWith('image/')) {
                    reader.onload = async () => {
                      const base64Data = (reader.result as string).split(',')[1];
                      await handleTranslate({ data: base64Data, mimeType: file.type }, true);
                    };
                    reader.readAsDataURL(file);
                  } else {
                    reader.onload = () => { setState(prev => ({ ...prev, sourceText: reader.result as string })); setMode(InputMode.TEXT); };
                    reader.readAsText(file);
                  }
                }} className="hidden" accept=".txt,.jpg,.jpeg,.png" />
              </div>
            )}

            {mode !== InputMode.URL && (
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex items-center gap-2">
                     <Sparkles className="w-4 h-4 text-amber-500" /> {mode === InputMode.HAN_VIET ? "Chế độ sửa convert" : "Chế độ dịch thuật AI"}
                  </p>
                  {state.isTranslating && progress.total > 1 && (
                    <p className="text-[10px] text-red-600 font-black uppercase">
                      Đang xử lý phần {progress.current}/{progress.total} (Chương dài)...
                    </p>
                  )}
                </div>
                <button
                  disabled={state.isTranslating || (!state.sourceText.trim() && mode !== InputMode.FILE)}
                  onClick={() => handleTranslate()}
                  className={`w-full sm:w-auto px-12 py-5 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl transition-all flex items-center justify-center gap-3 transform active:scale-95 ${mode === InputMode.HAN_VIET ? 'bg-amber-600' : 'bg-red-600'} disabled:bg-slate-300`}
                >
                  {state.isTranslating ? <><Loader2 className="w-5 h-5 animate-spin" /> Xử lý...</> : mode === InputMode.HAN_VIET ? "Chuốt Hán Việt" : "Dịch Ngay"}
                </button>
              </div>
            )}
          </div>
        </section>

        {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-5 rounded-2xl flex flex-col gap-3 print:hidden">
                <div className="flex items-center gap-4"><ShieldAlert className="w-6 h-6 shrink-0 text-red-600" /> <span className="text-sm font-bold uppercase tracking-tight">Lỗi</span></div>
                <p className="text-sm opacity-90 pl-10 border-l-2 border-red-200">{state.error}</p>
                <button onClick={() => handleTranslate()} className="w-fit px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors">Thử lại</button>
            </div>
        )}

        {/* Results Area */}
        {state.result && (
          <section id="translation-result" className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-12 duration-700 print:shadow-none print:border-none">
            <div className="p-4 bg-slate-50/90 backdrop-blur border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-16 z-30 print:hidden">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className={`p-3 rounded-xl ${mode === InputMode.HAN_VIET ? 'bg-amber-100' : 'bg-red-100'}`}>
                  {mode === InputMode.HAN_VIET ? <Sparkles className="w-5 h-5 text-amber-600" /> : <BookOpen className="w-5 h-5 text-red-600" />}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-black text-slate-800 truncate pr-2">{state.result.title}</h4>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{state.result.chapterNumber}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <div className="flex bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                   <button 
                    onClick={() => copyToClipboard(state.result?.content || '', 'copy-translated')} 
                    className={`px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 ${copyFeedback === 'copy-translated' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-600 hover:text-red-600'}`}
                    title="Copy bản dịch"
                   >
                     {copyFeedback === 'copy-translated' ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />} Sao chép
                   </button>
                </div>
                
                <div className="relative" ref={exportMenuRef}>
                  <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="px-5 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all text-xs font-bold flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" /> Xuất File <ChevronDown className={`w-3 h-3 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showExportMenu && (
                    <div className="absolute top-full right-0 mt-3 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-40 overflow-hidden animate-in fade-in slide-in-from-top-4">
                      <div className="p-3 border-b border-slate-50 bg-slate-50/50"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Văn phòng</span></div>
                      <button onClick={() => downloadFile('docx')} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-blue-50 flex items-center gap-3 text-slate-700 transition-colors border-b border-slate-50"><FileBox className="w-4 h-4 text-blue-500" /> MS Word (.docx)</button>
                      
                      <div className="p-3 border-b border-slate-50 bg-slate-50/50"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Đọc sách / PDF</span></div>
                      <button onClick={() => downloadFile('html')} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-orange-50 flex items-center gap-3 text-slate-700 transition-colors border-b border-slate-50"><Book className="w-4 h-4 text-orange-500" /> Ebook Clean HTML (.html)</button>
                      <button onClick={() => downloadFile('print')} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-red-50 flex items-center gap-3 text-slate-700 transition-colors border-b border-slate-50"><Printer className="w-4 h-4 text-red-500" /> Lưu PDF / In ngay</button>

                      <div className="p-3 border-b border-slate-50 bg-slate-50/50"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Kỹ thuật</span></div>
                      <button onClick={() => downloadFile('txt')} className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-slate-50 flex items-center gap-3 text-slate-700 transition-colors border-b border-slate-50"><FileText className="w-4 h-4 text-slate-400" /> Plain Text (.txt)</button>
                    </div>
                  )}
                </div>

                <button onClick={() => setShowRefineInput(!showRefineInput)} className={`p-3 rounded-xl border transition-all ${showRefineInput ? 'bg-red-600 text-white' : 'bg-white text-slate-500'}`} title="Sửa lại"><RefreshCw className={`w-5 h-5 ${state.isTranslating ? 'animate-spin' : ''}`} /></button>
              </div>
            </div>

            {showRefineInput && (
              <div className="p-5 bg-slate-50 border-b border-slate-200 animate-in slide-in-from-top-4 print:hidden">
                <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
                  <input type="text" value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} placeholder="Yêu cầu sửa: thoát ý hơn, đổi xưng hô..." className="flex-1 px-5 py-3 border border-slate-200 rounded-xl outline-none" onKeyDown={(e) => e.key === 'Enter' && handleRetranslate()} />
                  <button onClick={handleRetranslate} disabled={state.isTranslating} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2">{state.isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sửa"} </button>
                </div>
              </div>
            )}

            <div className="p-8 md:p-24 bg-[#fcf9f2] min-h-[600px] print:p-0 print:bg-white">
              <div className="max-w-3xl mx-auto space-y-16">
                <div className="text-center space-y-8">
                  <h2 className="text-4xl md:text-6xl font-bold text-slate-900 novel-font italic leading-tight">{state.result.title}</h2>
                  <div className="space-y-4">
                    <div className="inline-block px-6 py-1.5 bg-red-600 text-white text-xs font-black uppercase tracking-[0.5em] rounded-sm">{state.result.chapterNumber}</div>
                    <h3 className="text-2xl md:text-4xl font-semibold text-slate-700 novel-font">{state.result.chapterName}</h3>
                  </div>
                  <div className="w-64 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent mx-auto print:hidden"></div>
                </div>
                
                <div className="text-xl md:text-2xl text-slate-800 leading-[2.2] space-y-12 novel-font whitespace-pre-line text-justify first-letter:text-7xl first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-red-700 first-letter:mt-3 print:text-lg">
                  {state.result.content}
                </div>
              </div>
            </div>
            
            <div className="p-10 bg-slate-50 border-t border-slate-100 flex flex-col items-center gap-8 print:hidden">
              <button onClick={startNewTranslation} className="px-12 py-5 bg-white border border-slate-200 rounded-2xl font-black text-xs text-slate-600 hover:text-red-600 uppercase tracking-widest shadow-sm">Chương tiếp theo</button>
            </div>
          </section>
        )}
      </main>

      <footer className="py-16 bg-slate-900 text-slate-500 text-center px-6 print:hidden">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-center gap-3 text-slate-200"><Languages className="w-5 h-5 text-red-500" /><span className="font-black uppercase tracking-[0.3em] text-sm">Dịch Truyện AI 3.5 Platinum</span></div>
          <p className="text-[11px] font-medium leading-relaxed max-w-lg mx-auto opacity-50 italic">Hỗ trợ xuất file đa định dạng, lưu trữ truyện cho các thiết bị đọc sách offline.</p>
        </div>
      </footer>
      
      <style>{`
        @keyframes progress { 0% { width: 0%; } 50% { width: 70%; } 100% { width: 100%; } }
        .animate-progress { animation: progress 3s infinite ease-in-out; }
        @media print {
          body { background: white !important; }
          header, footer, .print\\:hidden { display: none !important; }
          #translation-result { border: none !important; box-shadow: none !important; }
          .novel-font { font-family: 'Times New Roman', serif !important; }
        }
      `}</style>
    </div>
  );
};

export default App;
