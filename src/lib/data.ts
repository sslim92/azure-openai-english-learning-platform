
import { db } from './firebase';
import { collection, getDocs, doc, setDoc, writeBatch, addDoc, serverTimestamp } from 'firebase/firestore';

export type Question = {
  id: string; // e.g., 'english-2024-6-1'
  year?: number;
  month?: number; // 3, 6, 9, 11 (for CSAT)
  subject: 'English';
  topic: string;
  questionText: string;
  options: { id: string, text: string }[];
  correctOptionId: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  listeningScript?: string;
  imageDescription?: string; // Optional field for charts, graphs, etc.
  generationReason?: string; // Optional field to explain why an AI question was generated
};

export type ScriptMapping = {
    questionId: string; // The ID of the question to update
    script: string;     // The listening script to add
};

export type UserMistake = {
    id: string;
    userId: string; // Later, this will be the actual user's ID
    questionId: string;
    selectedOptionId: string;
    reason: string;
    timestamp: any; // Firestore server timestamp
};


const questionsCollection = collection(db, 'questions');
const mistakesCollection = collection(db, 'userMistakes');


let questionsCache: Question[] | null = null;

function sortQuestions(questions: Question[]): Question[] {
    return questions.filter(q => q.subject === 'English').sort((a,b) => {
      // Questions without year/month (AI-generated) should come first.
      if (a.year === undefined && b.year !== undefined) return -1;
      if (a.year !== undefined && b.year === undefined) return 1;
       if (a.year === undefined && b.year === undefined) {
         // Sort AI questions by creation time (newest first, assuming ID is timestamp-based)
         return (parseInt(b.id.split('-').pop() || '0')) - (parseInt(a.id.split('-').pop() || '0'));
      }

      if (b.year && a.year && b.year !== a.year) return b.year - a.year;
      if (b.month && a.month && b.month !== a.month) return b.month - a.month;
      
      const numA = parseInt(a.id.split('-').pop() || '0');
      const numB = parseInt(b.id.split('-').pop() || '0');
      return numA - numB;
    });
}


export async function getQuestions(): Promise<Question[]> {
  if (questionsCache) {
    return questionsCache;
  }

  try {
    const querySnapshot = await getDocs(questionsCollection);
    let questions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
    
    if (querySnapshot.empty) {
        console.log("Firestore is empty. Seeding with initial questions...");
        const initialQuestions = getInitialQuestions();
        await addQuestions(initialQuestions); 
        questions = initialQuestions;
    }
    
    questionsCache = sortQuestions(questions);
    return questionsCache;
  } catch (error) {
    console.error("Error getting questions, returning initial data:", error);
    return getInitialQuestions();
  }
}

export async function addQuestions(questions: Question[]): Promise<void> {
  const batch = writeBatch(db);
  for (const q of questions) {
    const questionRef = doc(db, "questions", q.id);
    const { id, ...questionData } = q;
    batch.set(questionRef, questionData);
  }
  await batch.commit();

  // Invalidate cache
  questionsCache = null;
}

export async function addUserMistake(mistake: Omit<UserMistake, 'id' | 'timestamp'>): Promise<void> {
    await addDoc(mistakesCollection, {
        ...mistake,
        timestamp: serverTimestamp()
    });
}

export async function updateQuestionsWithScripts(scripts: ScriptMapping[]): Promise<void> {
  const batch = writeBatch(db);
  for (const scriptMapping of scripts) {
    const questionRef = doc(db, "questions", scriptMapping.questionId);
    batch.update(questionRef, { listeningScript: scriptMapping.script });
  }
  await batch.commit();
  questionsCache = null; // Invalidate cache
}


export async function getQuestionById(id: string): Promise<Question | null> {
    const questions = await getQuestions();
    const question = questions.find(q => q.id === id) ?? null;
    return question;
}

export async function getAvailableYears(): Promise<number[]> {
    const questions = await getQuestions();
    const years = [...new Set(questions.map(q => q.year).filter(y => y !== undefined) as number[])];
    return years.sort((a, b) => b - a); // Sort in descending order
}

export async function getAvailableMonths(year: number): Promise<number[]> {
    let questions = await getQuestions();
    questions = questions.filter(q => q.year === year);
    const months = [...new Set(questions.map(q => q.month).filter(m => m !== undefined) as number[])];
    return months.sort((a, b) => b - a);
}


function getInitialQuestions(): Question[] {
    return [
      {
        id: 'english-2023-11-1',
        year: 2023,
        month: 11,
        subject: 'English',
        topic: '어휘',
        questionText: '"ephemeral"과 동의어인 단어는 무엇입니까?',
        options: [
          { id: 'a', text: '영구적인 (Permanent)' },
          { id: 'b', text: '일시적인 (Transitory)' },
          { id: 'c', text: '아름다운 (Beautiful)' },
          { id: 'd', text: '필수적인 (Essential)' },
        ],
        correctOptionId: 'b',
        explanation: '"ephemeral"은 매우 짧은 시간 동안 지속되는 것을 의미합니다. "Transitory" 또한 영구적이지 않다는 의미이므로 정답입니다.',
        difficulty: 'Medium',
      },
      {
        id: 'english-2024-6-1',
        year: 2024,
        month: 6,
        subject: 'English',
        topic: '문법',
        questionText: '문법적으로 올바른 문장을 고르시오.',
        options: [
            { id: 'a', text: 'He do not like apples.' },
            { id: 'b', text: 'She is more taller than her brother.' },
            { id: 'c', text: 'They have been studying for three hours.' },
            { id: 'd', text: 'The cat layed on the mat.' },
        ],
        correctOptionId: 'c',
        explanation: '정답은 (c)입니다. (a)는 "He does not..."가 되어야 합니다. (b)는 "She is taller..."가 되어야 합니다. (d)는 "The cat lay on the mat."가 되어야 합니다.',
        difficulty: 'Easy',
      },
      {
        id: 'english-2022-9-1',
        year: 2022,
        month: 9,
        subject: 'English',
        topic: '독해',
        questionText: '다음 글의 주제로 가장 적절한 것은 무엇입니까?\n\n기술 디자인의 세계에서 "원활함(seamlessness)"이라는 개념이 점점 더 중요해지고 있습니다. 이는 기술이 우리의 일상생활에 자연스럽게 녹아들어, 사용자가 더 이상 기술의 존재를 의식하지 않게 만드는 것을 목표로 합니다. 본질적으로 이 목표는 기술이 너무나 통합적이고 직관적이어서, 기술처럼 느껴지지 않고 경험의 자연스러운 일부가 되도록 만드는 것입니다.',
        options: [
            { id: 'a', text: '기술이 보이지 않게 되는 것의 중요성' },
            { id: 'b', text: '최신 기술 디자인의 복잡성' },
            { id: 'c', text: '일상생활에서의 기술의 단점' },
            { id: 'd', text: '미래 기술 발전에 대한 예측' },
        ],
        correctOptionId: 'a',
        explanation: '이 지문의 핵심 주제는 기술 디자인에서의 \'원활함\'입니다. 이는 기술이 \'우리의 일상 생활에 자연스럽게 녹아들어\' 사용자가 \'더 이상 기술의 존재를 인식하지 못하게\' 만드는 것을 목표로 한다고 설명합니다. 본질적으로 이 목표는 기술이 너무 통합적이고 직관적이어서 기술처럼 느껴지지 않고 경험의 자연스러운 일부가 되도록 만드는 것입니다. 선택지 (a)는 기술이 보이지 않거나 자연스럽게 통합되어야 한다는 이 아이디어를 완벽하게 요약합니다.',
        difficulty: 'Medium',
      },
      {
        id: 'english-2023-11-2',
        year: 2023,
        month: 11,
        subject: 'English',
        topic: '관용 표현',
        questionText: '"bite the bullet"이라는 관용어의 의미는 무엇입니까?',
        options: [
            { id: 'a', text: '무언가를 매우 빨리 먹다.' },
            { id: 'b', text: '치과에 가다.' },
            { id: 'c', text: '어려운 상황을 용감하게 마주하다.' },
            { id: 'd', text: '말을 멈추다.' },
        ],
        correctOptionId: 'c',
        explanation: '"bite the bullet"은 고통스럽거나 어려운 상황을 결단력과 용기를 가지고 견디는 것을 의미합니다.',
        difficulty: 'Hard',
      },
       {
        id: 'english-2024-6-2',
        year: 2024,
        month: 6,
        subject: 'English',
        topic: '듣기',
        questionText: '대화를 듣고, 남자의 마지막 말에 대한 여자의 응답으로 가장 적절한 것을 고르시오.',
        options: [
          { id: 'a', text: 'I think I can finish it by then.' },
          { id: 'b', text: 'I already saw that movie.' },
          { id: 'c', text: 'He is a very famous actor.' },
          { id: 'd', text: 'I will go to the library tomorrow.' },
        ],
        correctOptionId: 'a',
        explanation: '남자가 프로젝트 마감일에 대해 걱정하자, 여자는 그때까지 끝낼 수 있을 것이라고 안심시키는 것이 가장 자연스러운 응답입니다.',
        difficulty: 'Easy',
        listeningScript: "M: I'm really worried about the project deadline. It's next Friday! W: Don't worry, we have plenty of time. Q: What would be the woman's most appropriate response to the man's last remark?",
      },
    ];
}


export const subjects = ['English'];
