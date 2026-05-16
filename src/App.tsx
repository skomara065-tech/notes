import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DownloadCloud, Settings, CheckCircle2 } from 'lucide-react';

export default function App() {
  const downloadExtension = async () => {
    try {
      const zip = new JSZip();
      
      const files = [
        'manifest.json',
        'background.js',
        'offscreen.html',
        'offscreen.js',
        'sidepanel.html',
        'sidepanel.js'
      ];
      
      const promises = files.map(async (filename) => {
        const response = await fetch(`/extension/${filename}`);
        if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
        const content = await response.text();
        zip.file(filename, content);
      });
      
      await Promise.all(promises);
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'lecture-notes-extension.zip');
    } catch (error) {
      console.error('Error zipping extension:', error);
      alert('Could not download extension files. Please make sure the app is fully built.');
    }
  };

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : 'APP_URL';

  // --- Sidebar Preview State ---
  const [notionId, setNotionId] = useState('');
  const [isIdValid, setIsIdValid] = useState<boolean | null>(null);
  const [quota, setQuota] = useState(100);
  const [chunkInterval, setChunkInterval] = useState('15s');
  const [isRecording, setIsRecording] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: number; time: string; state: 'draft' | 'saved'; hasScreenshot: boolean; text: string; expanded: boolean }>>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasPendingScreenshot, setHasPendingScreenshot] = useState(false);

  useEffect(() => {
    const clean = notionId.replace(/-/g, '').trim();
    if (notionId.length === 0) {
      setIsIdValid(null);
    } else {
      setIsIdValid(clean.length === 32 && /^[a-zA-Z0-9]+$/.test(clean));
    }
  }, [notionId]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    // When recording starts, add a note after 2 seconds (simulate 1st chunk)
    if (isRecording) {
      timeout = setTimeout(() => {
        setQuota(q => Math.max(0, q - (Math.floor(Math.random() * 7) + 2)));
        setNotes(prev => [{
          id: Date.now(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          state: 'draft',
          hasScreenshot: hasPendingScreenshot,
          text: "The virtual DOM acts as a lightweight copy of the UI. Reconciliation is the process of diffing this copy with the real DOM to minimize performance costs. Missing dependencies in useEffect can lead to stale closures. Always include state and props referenced inside the effect.",
          expanded: false
        }, ...prev]);
        setHasPendingScreenshot(false);
      }, 2000);
    }
    return () => clearTimeout(timeout);
  }, [isRecording, chunkInterval]); // Adding chunkInterval just to prevent eslint loops but practically we just want it to run when isRecording flips to true. Actually, to keep it simple, it runs once after 2s of starting.

  const resetPreview = () => {
    setNotionId('');
    setQuota(100);
    setChunkInterval('15s');
    setIsRecording(false);
    setNotes([]);
    setSettingsOpen(false);
    setHasPendingScreenshot(false);
  };

  const getQuotaColor = () => {
    if (quota > 50) return 'text-green-500';
    if (quota > 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="h-16 border-b border-slate-100 flex items-center justify-between px-8 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-full"></div>
          </div>
          <span className="font-semibold text-lg tracking-tight">AI Note Taker</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-xs font-medium text-slate-600 truncate max-w-[200px] sm:max-w-xs">{currentUrl}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-auto justify-center bg-white">
        <section className="w-full max-w-7xl flex flex-col pt-8 pb-12 px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">Extension Setup & Preview</h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              A Chrome Extension that listens to your Udemy and YouTube lectures, 
              generates detailed summaries using Gemini AI, and saves them directly to your Notion workspace.
            </p>
          </div>

          <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column - Setup Instructions */}
            <div className="bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-sm p-8 flex flex-col gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col gap-6">
                <div className="flex items-center gap-2">
                  <DownloadCloud className="w-4 h-4 text-indigo-500" />
                  <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">1. Get the Extension</span>
                </div>
                <div className="space-y-4">
                  <p className="text-sm text-slate-600">
                    Download the Chrome Extension files to install them locally on your browser.
                  </p>
                  <button
                    onClick={downloadExtension}
                    className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    Download Extension ZIP
                  </button>
                </div>

                <div className="h-px w-full bg-slate-100 my-2"></div>

                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">2. Install in Chrome</span>
                </div>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <div className="w-1 bg-indigo-200 rounded-full shrink-0"></div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5 uppercase tracking-tight">Unzip Folder</h3>
                      <p className="text-sm text-slate-600">Extract the downloaded ZIP file.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1 bg-indigo-200 rounded-full shrink-0"></div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5 uppercase tracking-tight">Manage Extensions</h3>
                      <p className="text-sm text-slate-600">Open Chrome and navigate to <code className="bg-slate-50 border border-slate-200 px-1 py-0.5 rounded text-xs font-mono">chrome://extensions/</code></p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1 bg-indigo-200 rounded-full shrink-0"></div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5 uppercase tracking-tight">Enable Developer Mode</h3>
                      <p className="text-sm text-slate-600">Toggle "Developer mode" in the top right corner.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <div className="w-1 bg-indigo-200 rounded-full shrink-0"></div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-0.5 uppercase tracking-tight">Load Unpacked</h3>
                      <p className="text-sm text-slate-600">Click "Load unpacked" and select the unzipped folder.</p>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                </div>
                <p className="text-sm text-slate-700 font-medium">
                  Open any Udemy or YouTube lecture, click the extension, hit "Start Listening", and let the AI capture the knowledge! Note: Audio segments process best under 1 hour.
                </p>
              </div>
            </div>

            {/* Right Column - Interactive Preview */}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-4 h-4 rounded-full bg-red-500 relative flex items-center justify-center">
                   <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full -ml-1"></div>
                   <div className="w-1.5 h-1.5 bg-green-500 rounded-full absolute right-0"></div>
                </div>
                <span className="text-sm font-semibold text-slate-700">Extension Preview</span>
              </div>

              {/* Sidebar Frame */}
              <div className="w-[360px] h-[600px] bg-[#f8fafc] border border-slate-300 rounded-xl shadow-xl flex flex-col text-xs text-[#0f172a] overflow-hidden relative">
                
                {/* SECTION 1 - Top Config */}
                <div className="px-4 py-4 bg-white border-b border-slate-200 shrink-0">
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Notion Page ID</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={notionId}
                        onChange={(e) => setNotionId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 outline-none" 
                        placeholder="32-char Notion ID..." 
                      />
                      <span className="absolute right-3 top-2 text-xs">
                        {isIdValid === true && '✅'}
                        {isIdValid === false && '❌'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mb-5">
                    <svg className="transform -rotate-90 origin-center -ml-1" width="40" height="40" viewBox="0 0 36 36">
                      <path className="text-slate-100" strokeWidth="4" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className={`${getQuotaColor()} transition-all duration-700 ease-out`} strokeWidth="4" strokeDasharray={`${Math.round(quota)}, 100`} stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                    </svg>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Gemini API Quota</span>
                      <span className="text-xs font-bold text-slate-800 leading-none"><span>{Math.round(quota)}</span>% <span className="font-medium text-slate-500">Free Tier</span></span>
                    </div>
                  </div>

                  {/* SECTION 2 - Record Interval Selector */}
                  <div className="mb-4">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 block">Record Interval</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200">
                      {['15s', '30s', '1m', '2m'].map(val => (
                        <button 
                          key={val}
                          onClick={() => setChunkInterval(val)}
                          className={`flex-1 py-1.5 rounded-md transition ${chunkInterval === val ? 'bg-white shadow-sm font-semibold text-slate-800' : 'text-slate-500 hover:text-slate-700 font-medium'}`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SECTION 3 - Controls */}
                  <div className="flex gap-2 h-10">
                    {!isRecording ? (
                      <button 
                        onClick={() => setIsRecording(true)}
                        className="flex-1 bg-indigo-600 text-white rounded-lg font-semibold shadow-sm hover:bg-indigo-700 transition tracking-wide text-sm flex items-center justify-center gap-2"
                      >
                         ▶ Start Listening
                      </button>
                    ) : (
                      <button 
                        onClick={() => setIsRecording(false)}
                        className="flex-1 bg-red-600 text-white rounded-lg font-semibold shadow-sm hover:bg-red-700 transition tracking-wide text-sm flex items-center justify-center gap-2"
                      >
                         <div className="w-2 h-2 bg-white rounded-sm animate-pulse"></div> Stop Listening
                      </button>
                    )}
                    <button 
                      onClick={() => setHasPendingScreenshot(true)}
                      className={`w-12 border rounded-lg text-lg transition flex items-center justify-center ${hasPendingScreenshot ? 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-200' : 'bg-slate-50 hover:bg-slate-100 border-slate-200'}`} 
                      title="Capture Screenshot"
                    >
                      📸
                    </button>
                  </div>
                </div>

                {/* SECTION 4 - Notes Preview */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3">
                  {notes.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-medium italic">
                      Notes will appear here...
                    </div>
                  ) : (
                    notes.map(note => (
                      <div key={note.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-xs relative overflow-hidden transition-all">
                        <div className="flex justify-between items-center mb-2">
                          <span className="font-bold text-[10px] text-slate-400 uppercase tracking-widest">{note.time}</span>
                          {note.state === 'saved' ? (
                            <span className="text-green-600 font-bold flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Saved ✓</span>
                          ) : (
                            <span className="text-slate-400 font-medium">Draft</span>
                          )}
                        </div>
                        {note.hasScreenshot && (
                          <div className={`w-full rounded bg-slate-100 mb-2 border border-slate-200 overflow-hidden cursor-pointer flex items-center justify-center ${note.expanded ? '' : 'h-24'}`}>
                            {/* Placeholder Screenshot */}
                            <div className={`w-full h-full bg-gradient-to-br from-slate-200 to-slate-100 flex items-center justify-center text-slate-400 text-3xl font-bold ${note.expanded ? 'aspect-video' : 'h-full object-cover'}`}>
                              🏞️
                            </div>
                          </div>
                        )}
                        <div className={`text-slate-700 leading-relaxed font-medium mb-2 ${note.expanded ? '' : 'line-clamp-3'}`}>
                          {note.text}
                        </div>
                        {note.text.length > 100 && (
                          <button 
                            onClick={() => setNotes(notes.map(n => n.id === note.id ? { ...n, expanded: !n.expanded } : n))}
                            className="text-indigo-600 font-semibold w-full text-center py-1.5 mt-1 bg-indigo-50 rounded hover:bg-indigo-100 transition"
                          >
                            {note.expanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {/* SECTION 5 - Bottom Bar */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0 space-y-3">
                  <button 
                    onClick={() => {
                      if (notes.length) setNotes(notes.map(n => ({...n, state: 'saved'})));
                    }}
                    className="w-full bg-slate-900 text-white rounded-lg py-2.5 font-semibold shadow-sm hover:bg-slate-800 transition tracking-wide text-sm"
                  >
                    Save All to Notion
                  </button>
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <button 
                      onClick={() => setSettingsOpen(!settingsOpen)}
                      className="w-full font-medium py-2 px-3 bg-slate-50 hover:bg-slate-100 transition flex justify-between items-center text-slate-600"
                    >
                      <span className="flex items-center gap-2">⚙ Settings</span>
                      <span className={`text-[10px] transition-transform ${settingsOpen ? 'rotate-180' : ''}`}>▼</span>
                    </button>
                    {settingsOpen && (
                      <div className="p-3 border-t border-slate-200 space-y-3 bg-white text-left">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Backend URL</label>
                          <input type="text" defaultValue={currentUrl} className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Notion API Key</label>
                          <input type="password" placeholder="secret_..." className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <button 
                onClick={resetPreview}
                className="mt-6 text-sm text-slate-500 hover:text-slate-800 underline underline-offset-4"
              >
                Reset Preview
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="h-10 bg-slate-900 text-white flex items-center px-8 text-[10px] justify-between uppercase tracking-tighter font-medium shrink-0">
        <div className="flex gap-4">
          <span>AI Setup Dashboard</span>
          <span className="text-slate-500">•</span>
          <span>Status: Ready</span>
        </div>
        <div className="flex gap-4">
          <span>Chrome Extension</span>
          <span className="text-slate-500">•</span>
          <span>Local Deployment</span>
        </div>
      </footer>
    </div>
  );
}

