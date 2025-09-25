import { NextResponse } from 'next/server';
import { getQuestions } from '@/lib/data';

export async function GET() {
  try {
    const questions = await getQuestions();
    
    if (questions.length === 0) {
      return NextResponse.json({ error: 'No questions available' }, { status: 404 });
    }
    
    const randomQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    return NextResponse.json({ questionId: randomQuestion.id });
  } catch (error) {
    console.error('Error getting random question:', error);
    return NextResponse.json({ error: 'Failed to get random question' }, { status: 500 });
  }
}