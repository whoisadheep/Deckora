import { Request, Response } from 'express';
import { generatePresentationOutline } from '../services/ai.service';
import { generatePptx, SlideData } from '../services/pptx.service';

export async function createOutline(req: Request, res: Response) {
    try {
        const { topic, model } = req.body;

        if (!topic) {
            res.status(400).json({ error: 'Topic is required' });
            return;
        }
        const outline = await generatePresentationOutline(topic, model);

        res.json({ success: true, data: outline });
    } catch (error) {
        console.error('Error generating outline:', error);
        res.status(500).json({ error: 'Failed to generate presentation outline' });
    }
}

export async function exportPresentation(req: Request, res: Response) {
    try {
        const { topic, model } = req.body;

        if (!topic) {
            res.status(400).json({ error: 'Topic is required' });
            return;
        }

        console.log(`Generating AI outline for: ${topic} using model: ${model || 'nvidia'}...`);
        const outline = await generatePresentationOutline(topic, model);

        console.log(`Building PPTX file...`);
        const pptxBuffer = await generatePptx(outline.slides as SlideData[]);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
        res.setHeader('Content-Disposition', 'attachment; filename="presentation.pptx"');
        res.send(pptxBuffer);
    } catch (error: any) {
      console.error('Error exporting presentation:', error);
      res.status(500).json({ 
        error: 'Failed to export presentation', 
        details: error?.message || String(error),
        stack: error?.stack
      });
    }
}