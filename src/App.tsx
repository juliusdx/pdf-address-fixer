import { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { AddressConfig } from './components/AddressConfig';
import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [file, setFile] = useState<File | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      <header className="fixed top-0 inset-x-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-200/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
              P
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">
              PDF Address Fixer
            </span>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <AnimatePresence mode="wait">
          {!file ? (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center"
            >
              <div className="text-center max-w-2xl mx-auto mb-12">
                <h1 className="text-5xl font-bold tracking-tight text-slate-900 mb-6">
                  Update addresses in <span className="text-blue-600">seconds</span>.
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed">
                  Upload your PDF, specify the old address, and we'll overlay the new one automatically.
                  Secure, client-side, and super simple.
                </p>
              </div>

              <FileUpload onFileSelect={setFile} />
            </motion.div>
          ) : (
            <motion.div
              key="config"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <AddressConfig file={file} onReset={() => setFile(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
