
'use server';

import { getDbPool, sql } from './db';

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

export type User = {
    userId: string;
    email: string;
    displayName: string | null;
};

export type UserMistake = {
    userId: string;
    questionId: string;
    selectedOptionKey: string;
    reason: string;
};

function mapRowToQuestion(questionRows: any[]): Question | null {
  if (questionRows.length === 0 || !questionRows[0].QuestionId) {
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
    options: firstRow.OptionKey ? questionRows.map(row => ({
      id: row.OptionKey,
      text: row.OptionText,
    })) : [],
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
      LEFT JOIN QuestionOptions qo ON q.QuestionId = qo.QuestionId
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
        LEFT JOIN QuestionOptions qo ON q.QuestionId = qo.QuestionId
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
    const transaction = pool.transaction();
    try {
        await transaction.begin();
        const questionTable = new sql.Table('Questions');
        questionTable.columns.add('QuestionId', sql.NVarChar(100), { nullable: false, primary: true });
        questionTable.columns.add('Year', sql.Int, { nullable: true });
        questionTable.columns.add('Month', sql.Int, { nullable: true });
        questionTable.columns.add('Intent', sql.NVarChar(50), { nullable: true });
        questionTable.columns.add('Topic', sql.NVarChar(100), { nullable: true });
        questionTable.columns.add('QuestionText', sql.NVarChar(sql.MAX), { nullable: true });
        questionTable.columns.add('Passage', sql.NVarChar(sql.MAX), { nullable: true });
        questionTable.columns.add('CorrectOptionId', sql.NVarChar(10), { nullable: true });
        questionTable.columns.add('Explanation', sql.NVarChar(sql.MAX), { nullable: true });
        questionTable.columns.add('Difficulty', sql.NVarChar(20), { nullable: true });
        questionTable.columns.add('ListeningScript', sql.NVarChar(sql.MAX), { nullable: true });
        questionTable.columns.add('GenerationReason', sql.NVarChar(sql.MAX), { nullable: true });
        
        const uniqueQuestions = new Map<string, Omit<Question, 'options'>>();
        questions.forEach(q => uniqueQuestions.set(q.id, q));
        
        uniqueQuestions.forEach(q => {
            questionTable.rows.add(q.id, q.year, q.month, q.intent, q.topic, q.questionText, q.passage, q.correctOptionId, q.explanation, q.difficulty, q.listeningScript, q.generationReason);
        });

        const mergeQuestionsQuery = `
            MERGE Questions AS target
            USING @questions AS source
            ON (target.QuestionId = source.QuestionId)
            WHEN NOT MATCHED THEN
                INSERT (QuestionId, Year, Month, Intent, Topic, QuestionText, Passage, CorrectOptionId, Explanation, Difficulty, ListeningScript, GenerationReason)
                VALUES (source.QuestionId, source.Year, source.Month, source.Intent, source.Topic, source.QuestionText, source.Passage, source.CorrectOptionId, source.Explanation, source.Difficulty, source.ListeningScript, source.GenerationReason);
        `;
        const questionRequest = transaction.request();
        questionRequest.input('questions', questionTable);
        await questionRequest.query(mergeQuestionsQuery);

        const optionTable = new sql.Table('QuestionOptions');
        optionTable.columns.add('QuestionId', sql.NVarChar(100), { nullable: false });
        optionTable.columns.add('OptionKey', sql.NVarChar(10), { nullable: false });
        optionTable.columns.add('OptionText', sql.NVarChar(1000), { nullable: true });

        const uniqueOptions = new Map<string, { questionId: string; id: string; text: string }>();
        options.forEach(o => uniqueOptions.set(`${o.questionId}-${o.id}`, o));

        uniqueOptions.forEach(o => {
            optionTable.rows.add(o.questionId, o.id, o.text);
        });

        const mergeOptionsQuery = `
            MERGE QuestionOptions AS target
            USING @options AS source
            ON (target.QuestionId = source.QuestionId AND target.OptionKey = source.OptionKey)
            WHEN NOT MATCHED THEN
                INSERT (QuestionId, OptionKey, OptionText)
                VALUES (source.QuestionId, source.OptionKey, source.Text);
        `;
        const optionRequest = transaction.request();
        optionRequest.input('options', optionTable);
        await optionRequest.query(mergeOptionsQuery);
        
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        console.error("Error in bulk merge operation:", error);
        throw error;
    }
}


export async function addUserMistake(mistake: UserMistake): Promise<void> {
  // Add a defensive check to prevent invalid UserId from being inserted.
  if (!mistake.userId || typeof mistake.userId !== 'string' || mistake.userId.trim() === '') {
    const error = new Error("Invalid or empty UserId. Cannot add user mistake.");
    console.error(error.message, { mistake });
    throw error;
  }

  try {
    const pool = await getDbPool();
    await pool.request()
      .input('UserId', sql.NVarChar(100), mistake.userId)
      .input('QuestionId', sql.NVarChar(100), mistake.questionId)
      .input('SelectedOptionKey', sql.NVarChar(10), mistake.selectedOptionKey)
      .input('UserReason', sql.NVarChar(sql.MAX), mistake.reason)
      .query(`
        INSERT INTO USERMISTAKES (UserId, QuestionId, SelectedOptionKey, UserReason, Timestamp)
        VALUES (@UserId, @QuestionId, @SelectedOptionKey, @UserReason, GETUTCDATE());
      `);
  } catch (error) {
    console.error("Error adding user mistake to DB:", error);
    // Re-throw the original database error to be handled by the caller.
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


export async function upsertUser(user: {userId: string; email: string; displayName: string | null }): Promise<void> {
    try {
        const pool = await getDbPool();
        await pool.request()
            .input('UserId', sql.NVarChar(100), user.userId)
            .input('Email', sql.NVarChar(255), user.email)
            .input('DisplayName', sql.NVarChar(255), user.displayName)
            .query(`
                MERGE INTO USERS AS target
                USING (SELECT @UserId AS UserId, @Email AS Email, @DisplayName AS DisplayName) AS source
                ON (target.UserId = source.UserId)
                WHEN MATCHED THEN
                    UPDATE SET Email = source.Email, DisplayName = source.DisplayName
                WHEN NOT MATCHED THEN
                    INSERT (UserId, Email, DisplayName, CreatedAt)
                    VALUES (source.UserId, source.Email, source.DisplayName, GETUTCDATE());
            `);
    } catch (error) {
        console.error('Error upserting user:', error);
        throw new Error('Database error while syncing user.');
    }
}
