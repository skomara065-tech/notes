import express from 'express';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { Client as NotionClient } from '@notionhq/client';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Use memory storage for multer (handling up to 50MB audio chunks)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }
  });

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Route to process audio and save to Notion
  app.post('/api/process-audio', upload.single('audio'), async (req, res) => {
    try {
      const { notionApiKey, notionPageId, instruction } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({ error: 'No audio file provided' });
      }

      if (!notionApiKey || !notionPageId) {
        return res.status(400).json({ error: 'Notion API Key and Page ID are required' });
      }

      const geminiApiKey = process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
      }

      const ai = new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });

      console.log(`Received audio file: ${audioFile.size} bytes, type: ${audioFile.mimetype}`);

      // 1. Send Audio to Gemini for Transcription & Summarization
      const audioPart = {
        inlineData: {
          mimeType: audioFile.mimetype,
          data: audioFile.buffer.toString('base64')
        }
      };

      const prompt = `You are a helpful study assistant. Listen to this lecture segment and create detailed, structured notes. 
Focus on:
1. Key concepts and definitions
2. Important examples or analogies
3. Actionable takeaways or summary points
${instruction ? `\nAdditional user instructions: ${instruction}` : ''}

Format the response cleanly without markdown code block wrappers so it can be easily adapted to Notion block format. Provide clear headings, bullet points, and paragraphs.`;

      const geminiResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-preview',
        contents: [audioPart, prompt],
        config: {
          temperature: 0.2, // Low temperature for factual notes
        }
      });

      const summaryText = geminiResponse.text;

      if (!summaryText) {
        return res.status(500).json({ error: 'Gemini returned an empty summary' });
      }

      // 2. Push to Notion Page using the provided credentials
      const notion = new NotionClient({ auth: notionApiKey });
      
      // We will append it to the page as simple text blocks for resilience
      // Split the text into paragraphs to create an array of paragraph blocks
      const paragraphs = summaryText.split('\n\n').filter(p => p.trim() !== '');
      
      const blocks = paragraphs.map(p => ({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'text',
              text: { content: p.substring(0, 2000) } // Notion has a 2000 char limit per rich text object
            }
          ]
        }
      }));

      // Add a timestamp / separator block at the top
      const timestampBlock = {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [
            {
              type: 'text',
              text: { content: `Lecture Notes - ${new Date().toLocaleString()}` }
            }
          ]
        }
      };

      await notion.blocks.children.append({
        block_id: notionPageId,
        children: [timestampBlock as any, ...blocks] as any
      });

      res.status(200).json({ success: true, summary: summaryText });
    } catch (error: any) {
      console.error('Error processing audio:', error);
      res.status(500).json({ error: error.message || 'Internal Server Error' });
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
