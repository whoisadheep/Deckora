import { Request, Response } from 'express';
import { generatePresentationOutline } from '../services/ai.service';
import { generatePptx, SlideData } from '../services/pptx.service';
import { extractText } from '../services/document.service';

export async function createOutline(req: Request, res: Response) {
    try {
        const { topic, model } = req.body;

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
        const { topic, model } = req.body;

        if (!topic) {
            res.status(400).json({ error: 'Topic is required' });
            return;
        }

        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Transfer-Encoding', 'chunked');

        const onProgress = (step: number, message: string) => {
            res.write(JSON.stringify({ status: 'progress', step, message }) + '\n');
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
        const pptxBuffer = await generatePptx(outline.slides as SlideData[], imagesFiles, onProgress);

        res.write(JSON.stringify({ 
            status: 'complete', 
            pptxBase64: pptxBuffer.toString('base64') 
        }) + '\n');
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