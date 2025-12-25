import { useState, useEffect } from 'react';
import { FileText, Search, Download, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff, MousePointer2, Save, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { findMatches, replaceAddress, getPdfText, type Match } from '../lib/pdf-utils';
import { PdfPreview } from './PdfPreview';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface AddressConfigProps {
    file: File;
    onReset: () => void;
}

const STORAGE_KEY = 'pdf-fixer-config';

interface SavedConfig {
    mode: 'auto' | 'manual';
    searchText: string;
    newAddress: string;
    manualSelection: Match | null;
}

export function AddressConfig({ file, onReset }: AddressConfigProps) {
    const [mode, setMode] = useState<'auto' | 'manual'>('auto');

    // Auto Search State
    const [searchText, setSearchText] = useState('');
    const [matches, setMatches] = useState<Match[]>([]);

    // Manual State
    const [manualSelection, setManualSelection] = useState<Match | null>(null);

    // Common State
    const [newAddress, setNewAddress] = useState('123 New Address St,\nNew City, State 12345');
    const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'processing' | 'done' | 'error'>('idle');
    const [statusMsg, setStatusMsg] = useState('');

    // Debug state
    const [showDebug, setShowDebug] = useState(false);
    const [debugText, setDebugText] = useState('');
    const [loadingDebug, setLoadingDebug] = useState(false);

    // Persistence state
    const [hasLoadedConfig, setHasLoadedConfig] = useState(false);

    // Load config on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const config: SavedConfig = JSON.parse(saved);
                if (config.newAddress) setNewAddress(config.newAddress);
                if (config.searchText) setSearchText(config.searchText);
                if (config.manualSelection) setManualSelection(config.manualSelection);
                if (config.mode) setMode(config.mode);
                setHasLoadedConfig(true);
            }
        } catch (e) {
            console.error("Failed to load config", e);
        }
    }, []);

    const saveConfig = () => {
        const config: SavedConfig = {
            mode,
            searchText,
            newAddress,
            manualSelection
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    };

    const clearConfig = () => {
        localStorage.removeItem(STORAGE_KEY);
        setHasLoadedConfig(false);
        // Optional: Reset state to defaults?
        // setNewAddress('123 New Address St,\nNew City, State 12345');
        // setManualSelection(null);
        // setMode('auto');
        setStatusMsg("Saved settings cleared.");
    };

    const handleSearch = async () => {
        if (!searchText.trim()) {
            setStatus('error');
            setStatusMsg("Please enter text to search for.");
            return;
        }

        setStatus('searching');
        setStatusMsg("Scanning PDF for matches...");

        try {
            await new Promise(r => setTimeout(r, 500));
            const results = await findMatches(file, searchText);
            setMatches(results);

            if (results.length === 0) {
                setStatusMsg("No matches found.");
                setStatus('error'); // Soft error
            } else {
                setStatus('found');
                setStatusMsg(`Found ${results.length} occurrence${results.length === 1 ? '' : 's'}.`);
            }
        } catch (e) {
            console.error(e);
            setStatus('error');
            setStatusMsg("Error reading PDF.");
        }
    };

    const handleManualSelection = (rect: { x: number; y: number; width: number; height: number; pageIndex: number; viewportHeight: number } | null) => {
        if (!rect) {
            // Don't clear manual selection immediately if we are just clicking elsewhere?
            // Actually PdfPreview sends null on mouseDown.
            // But we want to persist the OLD selection until a NEW valid one is made?
            // No, standard UX is click to clear.
            setManualSelection(null);
            setStatus('idle');
            return;
        }

        const y_pdf = rect.viewportHeight - rect.y - rect.height;

        setManualSelection({
            pageIndex: rect.pageIndex,
            x: rect.x,
            y: y_pdf,
            width: rect.width,
            height: rect.height,
            text: 'Manual Selection'
        });
        setStatus('found');
        setStatusMsg("Region selected.");
    };

    const handleProcess = async () => {
        setStatus('processing');
        setStatusMsg("Applying changes...");

        try {
            // Save config automatically on successful process attempt
            saveConfig();
            setHasLoadedConfig(true);

            await new Promise(r => setTimeout(r, 1000));

            const matchesToUse = mode === 'auto' ? matches : (manualSelection ? [manualSelection] : []);

            const blob = await replaceAddress(file, matchesToUse, newAddress);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `updated_${file.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setStatus('done');
            setStatusMsg("Success! File downloaded & settings saved.");
        } catch (e) {
            console.error(e);
            setStatus('error');
            setStatusMsg("Failed to generate PDF.");
        }
    };

    const toggleDebug = async () => {
        if (showDebug) {
            setShowDebug(false);
            return;
        }

        setLoadingDebug(true);
        try {
            const text = await getPdfText(file);
            setDebugText(text);
            setShowDebug(true);
        } catch (e) {
            console.error(e);
            setDebugText("Failed to load PDF text.");
            setShowDebug(true); // show error
        } finally {
            setLoadingDebug(false);
        }
    }

    const canProcess = status !== 'processing' &&
        ((mode === 'auto' && matches.length > 0) || (mode === 'manual' && manualSelection !== null));

    return (
        <div className="w-full max-w-4xl mx-auto mt-10 pb-20">
            {/* Header / File Info */}
            <div className="flex items-center justify-between mb-6 p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                        <FileText className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">{file.name}</h2>
                        <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={toggleDebug}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg"
                    >
                        {showDebug ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {loadingDebug ? "..." : showDebug ? "Hide Text" : "Inspect Text"}
                    </button>
                    <button
                        onClick={onReset}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Change File
                    </button>
                </div>
            </div>

            {hasLoadedConfig && (
                <div className="mb-6 flex items-center justify-between bg-blue-50 px-4 py-3 rounded-xl border border-blue-100 text-blue-700 text-sm">
                    <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        <span>Loaded saved settings from previous use.</span>
                    </div>
                    <button onClick={clearConfig} className="text-blue-500 hover:text-blue-700 hover:underline flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Clear defaults
                    </button>
                </div>
            )}

            {showDebug && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mb-8 overflow-hidden"
                >
                    <div className="bg-slate-900 text-slate-300 p-6 rounded-3xl shadow-inner font-mono text-sm">
                        <h3 className="text-white font-bold mb-4 border-b border-slate-700 pb-2">
                            Raw PDF Text Content
                        </h3>
                        <p className="mb-4 text-xs text-slate-400">
                            This is exactly what the tool sees. If your text isn't here, it might be an image or encoded strangely.
                            Copy the text from here to search for it.
                        </p>
                        <textarea
                            readOnly
                            value={debugText}
                            className="w-full h-64 bg-slate-950 p-4 rounded-xl border border-slate-800 focus:outline-none resize-none"
                        />
                    </div>
                </motion.div>
            )}

            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden mb-8">
                {/* Tabs */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => { setMode('auto'); setStatus('idle'); }}
                        className={cn(
                            "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                            mode === 'auto' ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        <Search className="w-4 h-4" />
                        Auto Search
                    </button>
                    <button
                        onClick={() => { setMode('manual'); setStatus('idle'); }}
                        className={cn(
                            "flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors",
                            mode === 'manual' ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:bg-slate-50"
                        )}
                    >
                        <MousePointer2 className="w-4 h-4" />
                        Manual Select
                    </button>
                </div>

                <div className="p-8">
                    {mode === 'auto' ? (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500">
                                Enter a unique line of text from the address you want to change.
                            </p>
                            <div className="relative">
                                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    value={searchText}
                                    onChange={(e) => setSearchText(e.target.value)}
                                    placeholder="e.g. 123 Main Street"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                                />
                            </div>

                            <button
                                onClick={handleSearch}
                                disabled={status === 'searching' || !searchText}
                                className={cn(
                                    "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                                    status === 'searching'
                                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                        : "bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg shadow-indigo-500/20"
                                )}
                            >
                                {status === 'searching' ? (<RefreshCw className="w-4 h-4 animate-spin" />) : "Find Matches"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 mb-4">
                                Draw a box around the address you want to replace.
                            </p>
                            <PdfPreview file={file} onSelectionChange={handleManualSelection} />
                            {manualSelection && (
                                <div className="text-xs text-green-600 font-bold flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    Selection active: {Math.round(manualSelection.width)}x{Math.round(manualSelection.height)} coords.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Configuration Panel */}
                <motion.div
                    layout
                    className={cn(
                        "bg-white p-6 rounded-3xl shadow-lg border border-slate-100 transition-all duration-500",
                        ((mode === 'auto' && matches.length > 0) || (mode === 'manual' && manualSelection))
                            ? "opacity-100 translate-y-0"
                            : "opacity-50 translate-y-4 pointer-events-none grayscale"
                    )}
                >
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-4">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                        Define New Address
                    </h3>

                    <div className="space-y-4">
                        <textarea
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                            rows={4}
                            className="w-full p-4 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none resize-none font-sans"
                        />

                        <button
                            onClick={handleProcess}
                            disabled={!canProcess}
                            className={cn(
                                "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2",
                                status === 'processing'
                                    ? "bg-slate-100 text-slate-400 cursor-wait"
                                    : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:shadow-xl shadow-blue-500/30 transform hover:-translate-y-0.5"
                            )}
                        >
                            {status === 'processing' ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Replace & Download
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>

                {/* Status / Output */}
                <motion.div
                    layout
                    className="bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]"
                >
                    <div className={cn(
                        "w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500",
                        status === 'done' ? "bg-green-100 text-green-600" :
                            status === 'error' ? "bg-red-100 text-red-600" :
                                status === 'found' ? "bg-indigo-100 text-indigo-600" :
                                    "bg-slate-200 text-slate-400"
                    )}>
                        {status === 'done' ? <CheckCircle className="w-10 h-10" /> :
                            status === 'error' ? <AlertCircle className="w-10 h-10" /> :
                                status === 'found' ? <CheckCircle className="w-10 h-10" /> :
                                    <FileText className="w-10 h-10" />}
                    </div>

                    <div className="max-w-xs">
                        {statusMsg ? (
                            <h3 className="text-xl font-bold text-slate-800 animate-fade-in">
                                {statusMsg}
                            </h3>
                        ) : (
                            <h3 className="text-xl font-bold text-slate-400">
                                Waiting for input...
                            </h3>
                        )}
                        <p className="text-slate-500 mt-2">
                            {status === 'idle' && "Start by searching or selecting a region."}
                            {status === 'found' && "Region active. Ready to replace."}
                            {status === 'done' && "File downloaded!"}
                        </p>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
