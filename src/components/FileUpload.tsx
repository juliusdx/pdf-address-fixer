import { useRef, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FileUploadProps {
    onFileSelect: (file: File) => void;
}

export function FileUpload({ onFileSelect }: FileUploadProps) {
    const [dragActive, setDragActive] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const [error, setError] = useState<string | null>(null);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const validateAndSelect = (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('Please upload a PDF file.');
            return;
        }
        setError(null);
        onFileSelect(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            validateAndSelect(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            validateAndSelect(e.target.files[0]);
        }
    };

    const onButtonClick = () => {
        inputRef.current?.click();
    };

    return (
        <div className="w-full max-w-xl mx-auto">
            <motion.div
                className={cn(
                    "relative flex flex-col items-center justify-center w-full min-h-[400px] p-10 mt-8",
                    "border-2 border-dashed rounded-3xl transition-all duration-300 ease-out cursor-pointer overflow-hidden",
                    dragActive
                        ? "border-blue-500 bg-blue-50/50 scale-[1.02] shadow-xl"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50 hover:shadow-lg"
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={onButtonClick}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <input
                    ref={inputRef}
                    className="hidden"
                    type="file"
                    accept=".pdf"
                    onChange={handleChange}
                />

                <div className="text-center z-10 space-y-4">
                    <div className={cn(
                        "w-20 h-20 mx-auto rounded-full flex items-center justify-center transition-colors duration-300",
                        dragActive ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400"
                    )}>
                        <Upload className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-2xl font-semibold text-slate-800">
                            {dragActive ? "Drop it like it's hot!" : "Upload your PDF"}
                        </h3>
                        <p className="text-slate-500 max-w-xs mx-auto">
                            Drag and drop your file here, or click to browse.
                        </p>
                    </div>
                </div>

                {/* Decorative background elements */}
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/50 to-transparent pointer-events-none" />
            </motion.div>

            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl flex items-center justify-center gap-2"
                    >
                        <AlertCircle className="w-5 h-5" />
                        <span>{error}</span>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
