import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import { generatePresentationOutline } from '../services/ai.service';
import { generatePptx, SlideData, runQA } from '../services/pptx.service';
import { extractText } from '../services/document.service';

export async function createOutline(req: Request, res: Response) {
    try {
        const { topic, model, theme } = req.body;

        if (!topic) {
            res.status(400).json({ error: 'Topic is required' });
            return;
        }

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

        // Extract text from uploaded document if present
        let documentContext: string | undefined;
        const documentFile = files?.['document']?.[0];
        if (documentFile) {
            console.log(`Extracting text from uploaded file: ${documentFile.originalname} (${documentFile.mimetype})`);
            documentContext = await extractText(documentFile.buffer, documentFile.mimetype);
            console.log(`  Extracted ${documentContext.length} characters from document`);
        }

        const imagesFiles = files?.['images'] || [];
        const imageNames = imagesFiles.map(f => f.originalname);

        const outline = await generatePresentationOutline(topic, model, documentContext, imageNames);

        res.json({ success: true, data: outline });
    } catch (error: any) {
        console.error('Error generating outline:', error);
        res.status(500).json({ error: error?.message || 'Failed to generate presentation outline' });
    }
}

export async function exportPresentation(req: Request, res: Response) {
    try {
        const { topic, model, theme } = req.body;

        if (!topic) {
            res.status(400).json({ error: 'Topic is required' });
            return;
        }

        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');

        const onProgress = (step: number, message: string, currentSlide?: number, totalSlides?: number) => {
            res.write(JSON.stringify({ status: 'progress', step, message, currentSlide, totalSlides }) + '\n');
        };

        const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

        // Extract text from uploaded document if present
        let documentContext: string | undefined;
        const documentFile = files?.['document']?.[0];
        if (documentFile) {
            console.log(`Extracting text from uploaded file: ${documentFile.originalname} (${documentFile.mimetype})`);
            documentContext = await extractText(documentFile.buffer, documentFile.mimetype);
            console.log(`  Extracted ${documentContext.length} characters from document`);
        }

        const imagesFiles = files?.['images'] || [];
        const imageNames = imagesFiles.map(f => f.originalname);

        console.log(`Generating AI outline for: ${topic} using model: ${model || 'nvidia'}${documentContext ? ' (with document context)' : ''}${imageNames.length > 0 ? ` (with ${imageNames.length} images)` : ''}...`);
        const outline = await generatePresentationOutline(topic, model, documentContext, imageNames, onProgress);

        console.log(`Building PPTX file...`);
        const pptxBuffer = await generatePptx(outline.slides as SlideData[], imagesFiles, onProgress, { theme });

        
        console.log(`Generating previews...`);
        onProgress(5, "Generating previews...");
        const previewImages = await runQA(pptxBuffer);
        
        // Save to public/exports
        const exportsDir = path.resolve(__dirname, '../../public/exports');
        if (!existsSync(exportsDir)) mkdirSync(exportsDir, { recursive: true });
        const id = Date.now().toString();
        const savePath = path.join(exportsDir, `${id}.pptx`);
        writeFileSync(savePath, pptxBuffer);
        const downloadUrl = `/api/presentations/download/${id}`;
        
        res.write(JSON.stringify({ 
            status: 'complete', 
            pptxBase64: pptxBuffer.toString('base64'),
            previewImages,
            downloadUrl
        }) + '\\n');
        res.end();

    } catch (error: any) {
        console.error('Error exporting presentation:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                status: 'error',
                message: error?.message || 'Failed to export presentation', 
                details: String(error),
                stack: error?.stack
            });
        } else {
            res.write(JSON.stringify({ 
                status: 'error', 
                message: error?.message || 'Failed to export presentation' 
            }) + '\n');
            res.end();
        }
    }
}
export async function downloadPresentation(req: Request, res: Response) {
    const id = req.params.id;
    const filepath = path.join(__dirname, '../../public/exports', `${id}.pptx`);
    if (existsSync(filepath)) {
        res.download(filepath, `presentation_${id}.pptx`);
    } else {
        res.status(404).send('Not found');
    }
}
