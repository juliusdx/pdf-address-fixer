import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { clsx } from 'clsx';

interface PdfPreviewProps {
    file: File;
    onSelectionChange: (rect: { x: number; y: number; width: number; height: number; pageIndex: number; viewportHeight: number } | null) => void;
    initialPage?: number;
    onLoadSuccess?: (numPages: number) => void;
}

export function PdfPreview({ file, onSelectionChange, initialPage = 1, onLoadSuccess }: PdfPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1.0);
    const [loading, setLoading] = useState(true);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(initialPage);
    const [pageRef, setPageRef] = useState<any>(null); // Store pdf page reference
    const [viewport, setViewport] = useState<any>(null);

    // Selection state (in canvas coordinates)
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPos, setStartPos] = useState<{ x: number, y: number } | null>(null);
    const [currentPos, setCurrentPos] = useState<{ x: number, y: number } | null>(null);
    const [selection, setSelection] = useState<{ x: number, y: number, w: number, h: number } | null>(null);

    // Initial render
    useEffect(() => {
        let mounted = true;

        const renderPage = async () => {
            if (!canvasRef.current || !containerRef.current) return;

            try {
                setLoading(true);
                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
                const doc = await loadingTask.promise;

                if (mounted) {
                    setNumPages(doc.numPages);
                    if (onLoadSuccess) onLoadSuccess(doc.numPages);
                }

                const page = await doc.getPage(currentPage);

                if (!mounted) return;
                setPageRef(page);

                // Calculate scale to fit container width
                const containerWidth = containerRef.current.clientWidth;
                // Get unscaled viewport first
                const unscaledViewport = page.getViewport({ scale: 1 });
                const desiredScale = (containerWidth - 40) / unscaledViewport.width; // 40px padding
                // Cap scale to avoid blurry huge images, but also don't be too small
                const finalScale = Math.min(Math.max(desiredScale, 0.5), 2.0);

                setScale(finalScale);
                const viewport = page.getViewport({ scale: finalScale });
                setViewport(viewport);

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                if (!context) return;

                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                if (mounted) setLoading(false);

            } catch (err) {
                console.error("Error rendering PDF:", err);
                setLoading(false);
            }
        };

        renderPage();

        return () => { mounted = false; };
    }, [file, currentPage]);

    // Handle mouse events for basic box drawing
    const getCoords = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        const coords = getCoords(e);
        setIsSelecting(true);
        setStartPos(coords);
        setCurrentPos(coords);
        setSelection(null); // Clear previous
        onSelectionChange(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isSelecting || !startPos) return;
        setCurrentPos(getCoords(e));
    };

    const handleMouseUp = () => {
        if (!isSelecting || !startPos || !currentPos || !viewport) return;
        setIsSelecting(false);

        // Calculate final box
        const x = Math.min(startPos.x, currentPos.x);
        const y = Math.min(startPos.y, currentPos.y);
        const w = Math.abs(currentPos.x - startPos.x);
        const h = Math.abs(currentPos.y - startPos.y);

        // Don't register tiny accidental clicks
        if (w < 5 || h < 5) return;

        setSelection({ x, y, w, h });

        onSelectionChange({
            x: x / scale, // Unscale x
            y: y / scale, // Unscale y (this is top-left based)
            width: w / scale,
            height: h / scale,
            pageIndex: currentPage - 1, // 0-based index
            viewportHeight: viewport.height / scale // This is the Original PDF Page Height
        });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Page Navigation */}
            {numPages > 1 && (
                <div className="flex items-center justify-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage <= 1 || loading}
                        className="px-3 py-1 text-sm font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                        Page {currentPage} of {numPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages || loading}
                        className="px-3 py-1 text-sm font-medium rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}

            <div ref={containerRef} className="w-full bg-slate-100 rounded-xl overflow-hidden shadow-inner border border-slate-200 relative min-h-[200px] flex items-center justify-center">
                {loading && (
                    <div className="text-slate-400 animate-pulse">Loading Page {currentPage}...</div>
                )}

                <div className="relative p-5">
                    {/* Canvas Wrapper */}
                    <canvas
                        ref={canvasRef}
                        className={clsx(
                            "shadow-lg rounded cursor-crosshair touch-none select-none",
                            loading ? "opacity-0" : "opacity-100"
                        )}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />

                    {/* Draw Selection Overlay */}
                    {isSelecting && startPos && currentPos && (
                        <div
                            className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
                            style={{
                                left: Math.min(startPos.x, currentPos.x) + 20, // +20 for padding offset
                                top: Math.min(startPos.y, currentPos.y) + 20,
                                width: Math.abs(currentPos.x - startPos.x),
                                height: Math.abs(currentPos.y - startPos.y),
                            }}
                        />
                    )}

                    {/* Persisted Selection Overlay */}
                    {!isSelecting && selection && (
                        <div
                            className="absolute border-2 border-green-500 bg-green-500/20 pointer-events-none flex items-center justify-center p-1"
                            style={{
                                left: selection.x + 20,
                                top: selection.y + 20,
                                width: selection.w,
                                height: selection.h,
                            }}
                        >
                            <span className="text-xs font-bold text-white bg-green-600 rounded px-1">Target</span>
                        </div>
                    )}

                    {!loading && !selection && !isSelecting && (
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                            <span className="bg-slate-800/80 text-white px-3 py-1 rounded-full text-sm backdrop-blur-sm shadow-lg whitespace-nowrap">
                                Drag to select address area
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
