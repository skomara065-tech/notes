import express from 'express';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Client as NotionClient } from '@notionhq/client';

// Simple in-memory cache for images
const imageCache = new Map<string, Buffer>();
let dailyTokenUsage = 0;
const TOKEN_LIMIT = 1500000;

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';

// Simple request queue to avoid rate limits
const audioQueue: Array<() => Promise<void>> = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  while (audioQueue.length > 0) {
    const task = audioQueue.shift();
    if (task) {
      await task();
      // Minimum 4 second gap between requests (15 RPM = 1 per 4s)
      await new Promise(r => setTimeout(r, 4000));
    }
  }
  isProcessingQueue = false;
}

async function generateWithRetry(ai: any, params: any, maxRetries = 2): Promise<any> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err: any) {
      const is429 = err?.status === 429 || 
                    err?.message?.includes('429') || 
                    err?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (is429 && attempt < maxRetries) {
        // Parse retry delay from error if available, default to 65 seconds
        const retryDelay = 65000;
        console.log(`Rate limited. Waiting ${retryDelay/1000}s before retry ${attempt + 1}...`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }
      throw err;
    }
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  const PORT = 3000;

  // Use memory storage for multer (handling up to 50MB audio chunks)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get('/api/token-usage', (req, res) => {
    res.json({
        used: dailyTokenUsage,
        limit: TOKEN_LIMIT,
        percentRemaining: Math.max(0, 100 - (dailyTokenUsage / TOKEN_LIMIT * 100)),
        model: MODEL
    });
  });

  app.get('/api/images/:id', (req, res) => {
    const img = imageCache.get(req.params.id);
    if (img) {
      res.setHeader('Content-Type', 'image/png');
      res.send(img);
    } else {
      res.status(404).end();
    }
  });

  // API Route to process audio and summarize
  app.post('/api/process-audio', upload.single('audio'), (req, res) => {
    const task = async () => {
      try {
        const audioFile = req.file;

        if (!audioFile) {
          return res.status(400).json({ error: 'No audio file provided' });
        }

        const geminiApiKey = process.env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
        }

        const ai = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

        const audioPart = {
          inlineData: {
            mimeType: audioFile.mimetype,
            data: audioFile.buffer.toString('base64')
          }
        };

        const prompt = `You are a helpful study assistant. Listen to this lecture segment and create detailed, structured notes. Focus on Key concepts and definitions, important examples. Format the response cleanly without markdown wrappers so it's ready for block layout. Provide clear paragraphs.`;

        const geminiResponse = await generateWithRetry(ai, {
          model: MODEL,
          contents: [audioPart, prompt],
          config: {
            temperature: 0.2, // Low temperature for factual notes
          }
        });

        if (geminiResponse.usageMetadata?.totalTokenCount) {
           dailyTokenUsage += geminiResponse.usageMetadata.totalTokenCount;
        }

        const summaryText = geminiResponse.text;

        if (!summaryText) {
          return res.status(500).json({ error: 'Gemini returned an empty summary' });
        }

        res.status(200).json({ success: true, summary: summaryText });
      } catch (error: any) {
        const is429 = error?.status === 429 || 
                      error?.message?.includes('RESOURCE_EXHAUSTED');
        
        if (is429) {
          return res.status(429).json({ 
            error: 'Rate limit reached. Please wait 60 seconds and try again.',
            retryAfter: 60
          });
        }
        
        console.error('Error processing audio:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: error.message || 'Internal Server Error' });
        }
      }
    };
    
    audioQueue.push(task);
    processQueue();
  });

  // API Route to save notes to Notion
  app.post('/api/save-notes', async (req, res) => {
    try {
      const { notionApiKey, notionPageId, notes } = req.body;
      if (!notionApiKey || !notionPageId || !notes || !Array.isArray(notes)) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const notion = new NotionClient({ auth: notionApiKey });
      
      for (const note of notes) {
        const blocks: any[] = [];
        
        // Process screenshot if exists
        if (note.screenshot) {
           const id = Date.now().toString() + '-' + Math.random().toString(36).substring(7);
           const base64Data = note.screenshot.replace(/^data:image\/png;base64,/, "");
           imageCache.set(id, Buffer.from(base64Data, 'base64'));
           const baseUrl = process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : `${req.protocol}://${req.get('host')}`;
           const imageUrl = `${baseUrl}/api/images/${id}`;
           
           blocks.push({
             object: 'block',
             type: 'image',
             image: {
               type: 'external',
               external: { url: imageUrl }
             }
           });
        }
        
        // Process textual notes
        if (note.text) {
          const paragraphs = note.text.split('\n\n').filter((p: string) => p.trim() !== '');
          for (const p of paragraphs) {
            blocks.push({
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [
                  {
                    type: 'text',
                    text: { content: p.substring(0, 2000) }
                  }
                ]
              }
            });
          }
        }
        
        if (blocks.length > 0) {
          await notion.blocks.children.append({
            block_id: notionPageId,
            children: blocks
          });
        }
      }
      
      res.status(200).json({ success: true });
    } catch(err: any) {
      console.error('Error saving to Notion:', err);
      res.status(500).json({ error: err.message || 'Error saving to Notion' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
