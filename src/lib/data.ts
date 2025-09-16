
'use server';

import { getDbPool, sql } from './db';

// Mapped types to match the Next.js app structure, from SQL schema
export type Question = {
  id: string; 
  year?: number;
  month?: number;
  intent: string;
  topic: string;
  questionText: string;
  passage: string;
  options: { id: string, text: string }[];
  correctOptionId: string;
  explanation: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  listeningScript?: string;
  generationReason?: string;
};

export type UserMistake = {
    userId: string;
    questionId: string;
    selectedOptionKey: string;
    reason: string;
};

// This function combines Questions and QuestionOptions from the two tables
function mapRowToQuestion(questionRows: any[]): Question | null {
  if (questionRows.length === 0) {
    return null;
  }

  const firstRow = questionRows[0];
  const question: Question = {
    id: firstRow.QuestionId,
    year: firstRow.Year,
    month: firstRow.Month,
    intent: firstRow.Intent,
    topic: firstRow.Topic,
    questionText: firstRow.QuestionText,
    passage: firstRow.Passage,
    correctOptionId: firstRow.CorrectOptionId,
    explanation: firstRow.Explanation,
    difficulty: firstRow.Difficulty,
    listeningScript: firstRow.ListeningScript,
    generationReason: firstRow.GenerationReason,
    options: questionRows.map(row => ({
      id: row.OptionKey,
      text: row.OptionText,
    })),
  };

  return question;
}

export async function getQuestions(): Promise<Question[]> {
  try {
    const pool = await getDbPool();
    const result = await pool.request().query(`
      SELECT 
        q.QuestionId, q.Year, q.Month, q.Intent, q.Topic, q.QuestionText, q.Passage, 
        q.CorrectOptionId, q.Explanation, q.Difficulty, q.ListeningScript, q.GenerationReason,
        qo.OptionKey, qo.OptionText
      FROM Questions q
      JOIN QuestionOptions qo ON q.QuestionId = qo.QuestionId
      ORDER BY q.CreatedAt DESC, qo.OptionKey ASC;
    `);

    const questionsMap: Map<string, any[]> = new Map();
    result.recordset.forEach(row => {
      if (!questionsMap.has(row.QuestionId)) {
        questionsMap.set(row.QuestionId, []);
      }
      questionsMap.get(row.QuestionId)!.push(row);
    });

    const questions: Question[] = [];
    questionsMap.forEach(rows => {
      const question = mapRowToQuestion(rows);
      if (question) {
        questions.push(question);
      }
    });

    return questions;
  } catch (error) {
    console.error("Error fetching questions from SQL DB:", error);
    return [];
  }
}

export async function getQuestionById(id: string): Promise<Question | null> {
  try {
    const pool = await getDbPool();
    const result = await pool.request()
      .input('QuestionId', sql.NVarChar, id)
      .query(`
        SELECT 
          q.QuestionId, q.Year, q.Month, q.Intent, q.Topic, q.QuestionText, q.Passage, 
          q.CorrectOptionId, q.Explanation, q.Difficulty, q.ListeningScript, q.GenerationReason,
          qo.OptionKey, qo.OptionText
        FROM Questions q
        JOIN QuestionOptions qo ON q.QuestionId = qo.QuestionId
        WHERE q.QuestionId = @QuestionId
        ORDER BY qo.OptionKey ASC;
      `);

    return mapRowToQuestion(result.recordset);
  } catch (error) {
    console.error(`Error fetching question by id ${id}:`, error);
    return null;
  }
}

export async function addQuestions(questions: Omit<Question, 'options'>[], options: { questionId: string; id: string; text: string }[]): Promise<void> {
    const pool = await getDbPool();
    const transaction = new sql.Transaction(pool);
    try {
        await transaction.begin();

        const questionTable = new sql.Table('Questions');
        questionTable.columns.add('QuestionId', sql.NVarChar(100));
        questionTable.columns.add('Year', sql.Int);
        questionTable.columns.add('Month', sql.Int);
        questionTable.columns.add('Intent', sql.NVarChar(50));
        questionTable.columns.add('Topic', sql.NVarChar(100));
        questionTable.columns.add('QuestionText', sql.NVarChar(sql.MAX));
        questionTable.columns.add('Passage', sql.NVarChar(sql.MAX));
        questionTable.columns.add('CorrectOptionId', sql.NVarChar(10));
        questionTable.columns.add('Explanation', sql.NVarChar(sql.MAX));
        questionTable.columns.add('Difficulty', sql.NVarChar(20));
        questionTable.columns.add('ListeningScript', sql.NVarChar(sql.MAX));
        questionTable.columns.add('GenerationReason', sql.NVarChar(sql.MAX));
        
        questions.forEach(q => {
            questionTable.rows.add(q.id, q.year, q.month, q.intent, q.topic, q.questionText, q.passage, q.correctOptionId, q.explanation, q.difficulty, q.listeningScript, q.generationReason);
        });

        const optionTable = new sql.Table('QuestionOptions');
        optionTable.columns.add('QuestionId', sql.NVarChar(100));
        optionTable.columns.add('OptionKey', sql.NVarChar(10));
        optionTable.columns.add('OptionText', sql.NVarChar(1000));

        options.forEach(o => {
            optionTable.rows.add(o.questionId, o.id, o.text);
        });

        const req = new sql.Request(transaction);
        await req.bulk(questionTable);
        await req.bulk(optionTable);
        
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        console.error("Error adding questions in bulk:", error);
        throw error;
    }
}


export async function addUserMistake(mistake: UserMistake): Promise<void> {
  try {
    const pool = await getDbPool();
    await pool.request()
      .input('UserId', sql.NVarChar, mistake.userId)
      .input('QuestionId', sql.NVarChar, mistake.questionId)
      .input('SelectedOptionKey', sql.NVarChar, mistake.selectedOptionKey)
      .input('UserReason', sql.NVarChar, mistake.reason)
      .query(`
        INSERT INTO UserMistakes (UserId, QuestionId, SelectedOptionKey, UserReason)
        VALUES (@UserId, @QuestionId, @SelectedOptionKey, @UserReason);
      `);
  } catch (error) {
    console.error("Error adding user mistake:", error);
    throw error;
  }
}

export async function getAvailableYears(): Promise<number[]> {
    try {
        const pool = await getDbPool();
        const result = await pool.request().query(
            `SELECT DISTINCT Year FROM Questions WHERE Year IS NOT NULL ORDER BY Year DESC`
        );
        return result.recordset.map(row => row.Year);
    } catch (error) {
        console.error("Error fetching available years:", error);
        return [];
    }
}

export async function getAvailableMonths(year: number): Promise<number[]> {
    try {
        const pool = await getDbPool();
        const result = await pool.request()
            .input('Year', sql.Int, year)
            .query(`SELECT DISTINCT Month FROM Questions WHERE Year = @Year AND Month IS NOT NULL ORDER BY Month DESC`);
        return result.recordset.map(row => row.Month);
    } catch (error) {
        console.error("Error fetching available months for year:", error);
        return [];
    }
}

export async function updateListeningScript(questionId: string, script: string): Promise<void> {
    try {
        const pool = await getDbPool();
        await pool.request()
            .input('QuestionId', sql.NVarChar, questionId)
            .input('ListeningScript', sql.NVarChar(sql.MAX), script)
            .query(`UPDATE Questions SET ListeningScript = @ListeningScript WHERE QuestionId = @QuestionId`);
    } catch (error) {
        console.error(`Error updating script for question ${questionId}:`, error);
        throw error;
    }
}
