import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface Match {
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
}

/**
 * Normalizes text for comparison:
 * - Lowercase
 * - Remove all whitespace
 * - Normalize Unicode (NFC)
 * - Normalize dashes/hyphens
 */
function normalize(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFC')
        .replace(/[\u2010-\u2015]/g, '-') // Normalize various dashes to hyphen
        .replace(/\s+/g, '');
}

/**
 * Extracts all text from the PDF for debugging purposes.
 */
export async function getPdfText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    let fullText = '';

    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(' ');
        fullText += `--- Page ${p} ---\n${pageText}\n\n`;
    }
    return fullText;
}

export async function findMatches(file: File, searchString: string): Promise<Match[]> {
    if (!searchString) return [];

    const cleanQuery = normalize(searchString);
    if (!cleanQuery) return [];

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const doc = await loadingTask.promise;
    const matches: Match[] = [];

    for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const items = content.items as any[];

        // Build map using the robust normalizer
        let cleanText = '';
        const charMap: { itemIndex: number }[] = [];

        items.forEach((item, itemIdx) => {
            const str = item.str;
            // We process char by char to handle "Block C - 13" vs "Block C-13" flexibility
            // But we need to preserve item mapping
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                // Check if char is "significant" (not whitespace)
                // We use the same normalize logic on the single char
                const nChar = normalize(char);
                if (nChar.length > 0) {
                    cleanText += nChar;
                    charMap.push({ itemIndex: itemIdx });
                }
            }
        });

        let startIndex = 0;
        while (true) {
            const foundIdx = cleanText.indexOf(cleanQuery, startIndex);
            if (foundIdx === -1) break;

            const firstCharInfo = charMap[foundIdx];
            const lastCharInfo = charMap[foundIdx + cleanQuery.length - 1];

            if (firstCharInfo && lastCharInfo) {
                const startItemIdx = firstCharInfo.itemIndex;
                const endItemIdx = lastCharInfo.itemIndex;

                let minX = Infinity, maxX = -Infinity;

                for (let i = startItemIdx; i <= endItemIdx; i++) {
                    const item = items[i];
                    // Skip items that are purely whitespace/invisible if possible?
                    // No, safer to include all in range.
                    const tx = item.transform;
                    const x = tx[4];
                    const w = item.width;

                    if (x < minX) minX = x;
                    if (x + w > maxX) maxX = x + w;
                }

                if (minX === Infinity) { // Fallback
                    const item = items[startItemIdx];
                    minX = item.transform[4];
                    maxX = minX + item.width;
                }

                const startItem = items[startItemIdx];
                const finalY = startItem.transform[5];
                const finalH = startItem.height || Math.abs(startItem.transform[3]);

                matches.push({
                    pageIndex: p - 1,
                    x: minX,
                    y: finalY,
                    width: maxX - minX,
                    height: finalH,
                    text: searchString
                });
            }

            startIndex = foundIdx + 1;
        }
    }
    return matches;
}

export async function replaceAddress(file: File, matches: Match[], newText: string): Promise<Blob> {
    const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const match of matches) {
        const page = pages[match.pageIndex];
        const { x, y, width, height } = match;

        page.drawRectangle({
            x: x - 2,
            y: y - 2,
            width: width + 4,
            height: height + 5,
            color: rgb(1, 1, 1),
        });

        // Heuristic: If height > 24, it's likely a manual block selection, not a single line font height.
        const isBlock = height > 24;
        const fontSize = isBlock ? 12 : (height > 5 ? height : 12);
        const lineHeight = fontSize * 1.2;

        const lines = newText.split('\n');

        // Calculate starting Y position
        let startY;
        if (isBlock) {
            // Vertically center in the block
            // y is the bottom of the block
            const boxCenterY = y + (height / 2);
            const textBlockHalfHeight = ((lines.length - 1) * lineHeight) / 2;
            // We adjust so the middle of the text block hits the center of the box
            // Note: PDF text draws from baseline. The "middle" of a line is roughly baseline + fontSize/3.
            // But simpler baseline centering:
            startY = boxCenterY + textBlockHalfHeight - (fontSize / 4);
        } else {
            // Standard baseline
            startY = y;
        }

        lines.forEach((line, index) => {
            const textWidth = helveticaFont.widthOfTextAtSize(line, fontSize);
            const centeredX = x + (width / 2) - (textWidth / 2);
            const lineY = startY - (index * lineHeight);

            page.drawText(line, {
                x: centeredX,
                y: lineY,
                size: fontSize,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
        });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
}

export async function shiftPageContent(pdfBlob: Blob, xOffset: number, yOffset: number): Promise<Blob> {
    if (xOffset === 0 && yOffset === 0) return pdfBlob;

    const originalPdf = await PDFDocument.load(await pdfBlob.arrayBuffer());
    const newPdf = await PDFDocument.create();

    const embeddedPages = await newPdf.embedPdf(originalPdf);

    for (let i = 0; i < embeddedPages.length; i++) {
        const embeddedPage = embeddedPages[i];
        const { width, height } = embeddedPage;

        const newPage = newPdf.addPage([width, height]);

        // Draw the embedded page onto the new page with offset
        newPage.drawPage(embeddedPage, {
            x: xOffset,
            y: yOffset,
        });
    }

    const pdfBytes = await newPdf.save();
    return new Blob([pdfBytes as any], { type: 'application/pdf' });
}
