import { config } from 'dotenv';
config();

import '@/ai/flows/recommend-similar-questions.ts';
import '@/ai/flows/analyze-user-weaknesses.ts';
import '@/ai/flows/extract-questions-from-pdf.ts';
import '@/ai/flows/generate-audio-from-text.ts';
import '@/ai/flows/match-scripts-to-questions.ts';
import '@/ai/flows/conversational-tutor.ts';
import '@/ai/flows/generate-similar-question.ts';
import '@/ai/flows/analyze-mistake-and-generate-question.ts';
