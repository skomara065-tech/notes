import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { DownloadCloud, Info, ArrowRight, Settings, CheckCircle2 } from 'lucide-react';

export default function App() {
  const downloadExtension = async () => {
    try {
      const zip = new JSZip();
      
      // Fetch files from public directory
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
        <section className="w-full max-w-5xl flex flex-col pt-8 pb-12 px-6">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold mb-2">Extension Setup</h1>
            <p className="text-sm text-slate-400">
              A Chrome Extension that listens to your Udemy and YouTube lectures, 
              generates detailed summaries using Gemini AI, and saves them directly to your Notion workspace.
            </p>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            {/* Left Column - Download & Setup */}
            <div className="bg-white p-8 flex flex-col gap-6">
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
                  className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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

            {/* Right Column - Configuration */}
            <div className="bg-slate-50 p-8 flex flex-col gap-6">
              <div className="bg-white h-full border border-slate-200 rounded-2xl shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2">
                  <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center"><div className="w-2 h-0.5 bg-white"></div></div>
                  <span className="text-xs font-bold text-slate-800">3. CONFIGURATION</span>
                </div>
                <div className="p-6 flex-1 flex flex-col gap-5">
                  <p className="text-sm text-slate-600">
                    Click the extension icon to open the configuration popup. You need:
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-tight">Backend URL</h3>
                      <code className="block bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-mono text-slate-700 select-all">
                        {currentUrl}
                      </code>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-tight">Notion API Key</h3>
                      <p className="text-sm text-slate-600">
                        Create an integration at <a href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer" className="text-indigo-600 font-medium">Notion Developers</a> and copy the Secret.
                      </p>
                    </div>

                    <div>
                      <h3 className="text-sm font-bold text-slate-900 mb-1 uppercase tracking-tight">Notion Page ID</h3>
                      <p className="text-sm text-slate-600 mb-2">
                        Get the 32-character ID from your Notion page link.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            </div>
            <p className="text-sm text-slate-700 font-medium">
              Open any Udemy or YouTube lecture, click the extension, hit "Start Listening", and let the AI capture the knowledge! Note: Audio segments process best under 1 hour.
            </p>
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
