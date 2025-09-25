import { NextResponse } from 'next/server';
import { getQuestions } from '@/lib/data';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeId = searchParams.get('exclude');
    
    const allQuestions = await getQuestions();
    
    if (allQuestions.length === 0) {
      return NextResponse.json({ error: 'No questions available' }, { status: 404 });
    }
    
    // 제외할 문제가 있는 경우 필터링
    const availableQuestions = excludeId 
      ? allQuestions.filter(q => q.id !== excludeId)
      : allQuestions;
    
    if (availableQuestions.length === 0) {
      return NextResponse.json({ error: 'No other questions available' }, { status: 404 });
    }
    
    const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    
    return NextResponse.json({ questionId: randomQuestion.id });
  } catch (error) {
    console.error('Error getting random question:', error);
    return NextResponse.json({ error: 'Failed to get random question' }, { status: 500 });
  }
}