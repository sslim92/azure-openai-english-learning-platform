
'use server';

import { getDbPool } from './db';
import sql from 'mssql';

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
    UserId: string;
    Email: string;
    DisplayName: string | null;
    CreatedAt: Date;
};

export type UserProfile = {
    userId: string;
    email: string;
    displayName: string | null;
    level: number;
    experiencePoints: number;
    stage: string;
};

export type UserStats = {
    totalQuestionsSolved: number;
    correctAnswers: number;
    accuracy: number;
};

export type UserCatfish = {
    UserId: string;
    Level: number;
    ExperiencePoints: number;
    Stage: string;
    UpdatedAt: Date;
};

export type UserMistake = {
    userId: string;
    questionId: string;
    selectedOptionKey: string;
    reason: string;
};

export type UserAnswer = {
    userId: string;
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
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

export async function getUserById(userId: string): Promise<User | null> {
    if (!userId) return null;
    try {
        const pool = await getDbPool();
        const result = await pool.request()
            .input('UserId', sql.NVarChar, userId)
            .query('SELECT * FROM USERS WHERE UserId = @UserId');
        
        return result.recordset.length > 0 ? result.recordset[0] as User : null;
    } catch (error) {
        console.error('Error fetching user by ID:', error);
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
                VALUES (source.QuestionId, source.OptionKey, source.Text)
            WHEN MATCHED THEN
                UPDATE SET OptionText = source.Text;
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
    throw error;
  }
}

export async function addUserAnswer(answer: UserAnswer): Promise<void> {
    if (!answer.userId || typeof answer.userId !== 'string' || answer.userId.trim() === '') {
        throw new Error("Invalid or empty UserId. Cannot add user answer.");
    }

    try {
        const pool = await getDbPool();
        await pool.request()
            .input('UserId', sql.NVarChar(100), answer.userId)
            .input('QuestionId', sql.NVarChar(100), answer.questionId)
            .input('SelectedOptionId', sql.NVarChar(10), answer.selectedOptionId)
            .input('IsCorrect', sql.Bit, answer.isCorrect)
            .query(`
                INSERT INTO UserAnswers (UserId, QuestionId, SelectedOptionId, IsCorrect, AnsweredAt)
                VALUES (@UserId, @QuestionId, @SelectedOptionId, @IsCorrect, GETUTCDATE());
            `);

    } catch (error) {
        console.error("Error adding user answer to DB:", error);
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
    const pool = await getDbPool();
    const transaction = pool.transaction();
    try {
        await transaction.begin();

        // Upsert user in USERS table
        const userRequest = transaction.request();
        await userRequest
            .input('UserId', sql.NVarChar(100), user.userId)
            .input('Email', sql.NVarChar(255), user.email)
            .input('DisplayName', sql.NVarChar(255), user.displayName)
            .query(`
                MERGE INTO USERS AS target
                USING (SELECT @UserId AS UserId, @Email AS Email, @DisplayName AS DisplayName) AS source
                ON (target.UserId = source.UserId)
                WHEN MATCHED THEN
                    UPDATE SET Email = source.Email, DisplayName = source.DisplayName
                WHEN NOT MATCHED BY TARGET THEN
                    INSERT (UserId, Email, DisplayName, CreatedAt)
                    VALUES (source.UserId, source.Email, source.DisplayName, GETUTCDATE());
            `);

        // Check if a catfish entry exists for the user
        const catfishRequest = transaction.request();
        const catfishResult = await catfishRequest
            .input('UserId', sql.NVarChar(100), user.userId)
            .query('SELECT 1 FROM UserCatfish WHERE UserId = @UserId');

        // If no catfish entry exists, create one
        if (catfishResult.recordset.length === 0) {
            const createCatfishRequest = transaction.request();
            await createCatfishRequest
                .input('UserId', sql.NVarChar(100), user.userId)
                .input('Level', sql.Int, 1)
                .input('ExperiencePoints', sql.Int, 0)
                .input('Stage', sql.NVarChar(50), '알')
                .query(`
                    INSERT INTO UserCatfish (UserId, Level, ExperiencePoints, Stage, UpdatedAt)
                    VALUES (@UserId, @Level, @ExperiencePoints, @Stage, GETUTCDATE());
                `);
        }

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        console.error('Error in upsertUser transaction:', error);
        throw new Error('Database error while syncing user and catfish.');
    }
}


export async function getUserProfile(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    try {
        const pool = await getDbPool();
        const result = await pool.request()
            .input('UserId', sql.NVarChar, userId)
            .query(`
                SELECT 
                    u.UserId,
                    u.Email,
                    u.DisplayName,
                    uc.Level,
                    uc.ExperiencePoints,
                    uc.Stage
                FROM USERS u
                LEFT JOIN UserCatfish uc ON u.UserId = uc.UserId
                WHERE u.UserId = @UserId;
            `);

        if (result.recordset.length === 0) {
            return null;
        }
        
        const profile = result.recordset[0];

        // If UserCatfish entry doesn't exist for some reason, return default values
        return {
            userId: profile.UserId,
            email: profile.Email,
            displayName: profile.DisplayName,
            level: profile.Level || 1,
            experiencePoints: profile.ExperiencePoints || 0,
            stage: profile.Stage || '알'
        };
    } catch (error) {
        console.error('Error fetching user profile from DB:', error);
        return null;
    }
}

export async function getUserStats(userId: string): Promise<UserStats> {
    if (!userId) return { totalQuestionsSolved: 0, correctAnswers: 0, accuracy: 0 };
    try {
        const pool = await getDbPool();
        const result = await pool.request()
            .input('UserId', sql.NVarChar, userId)
            .query(`
                SELECT 
                    COUNT(*) AS TotalQuestionsSolved,
                    SUM(CASE WHEN IsCorrect = 1 THEN 1 ELSE 0 END) AS CorrectAnswers
                FROM UserAnswers
                WHERE UserId = @UserId;
            `);

        if (result.recordset.length === 0) {
            return { totalQuestionsSolved: 0, correctAnswers: 0, accuracy: 0 };
        }
        
        const stats = result.recordset[0];
        const totalQuestionsSolved = stats.TotalQuestionsSolved || 0;
        const correctAnswers = stats.CorrectAnswers || 0;
        const accuracy = totalQuestionsSolved > 0 ? (correctAnswers / totalQuestionsSolved) * 100 : 0;

        return {
            totalQuestionsSolved,
            correctAnswers,
            accuracy: parseFloat(accuracy.toFixed(1)), // Return accuracy with one decimal place
        };
    } catch (error) {
        console.error('Error fetching user stats from DB:', error);
        return { totalQuestionsSolved: 0, correctAnswers: 0, accuracy: 0 };
    }
}


export async function updateUserCatfishExperience(userId: string, xpToAdd: number): Promise<void> {
  const pool = await getDbPool();
  const transaction = pool.transaction();
  
  const XP_PER_LEVEL = 30;
  const STAGES = [
    { level: 1, name: '알' },
    { level: 5, name: '치어' },
    { level: 10, name: '아기메기' },
    { level: 15, name: '성인메기' },
    { level: 20, name: '졸업생 메기' },
  ];

  try {
    await transaction.begin();

    // 1. Get current user's catfish data within the transaction
    const request = transaction.request();
    const result = await request
        .input('UserId', sql.NVarChar, userId)
        .query('SELECT Level, ExperiencePoints, Stage FROM UserCatfish WHERE UserId = @UserId');

    if (result.recordset.length === 0) {
        // This case should ideally not happen if upsertUser works correctly, but as a fallback:
        const insertRequest = transaction.request();
        await insertRequest
            .input('UserId', sql.NVarChar, userId)
            .input('NewLevel', sql.Int, 1)
            .input('NewExperiencePoints', sql.Int, xpToAdd)
            .input('NewStage', sql.NVarChar, '알')
            .query(`
                INSERT INTO UserCatfish (UserId, Level, ExperiencePoints, Stage, UpdatedAt)
                VALUES (@UserId, @NewLevel, @NewExperiencePoints, @NewStage, GETUTCDATE());
            `);
        console.log(`New catfish profile created and XP added for user ${userId}.`);
        await transaction.commit();
        return;
    }

    let { Level: currentLevel, ExperiencePoints: currentXp } = result.recordset[0];
    
    // 2. Calculate new XP and Level
    let newTotalXp = currentXp + xpToAdd;
    let newLevel = currentLevel;

    while (newTotalXp >= XP_PER_LEVEL) {
        newLevel += 1;
        newTotalXp -= XP_PER_LEVEL;
    }

    // 3. Determine new stage
    let newStage = STAGES[0].name;
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (newLevel >= STAGES[i].level) {
            newStage = STAGES[i].name;
            break;
        }
    }

    // 4. Update the database
    const updateRequest = transaction.request();
    await updateRequest
        .input('UserId', sql.NVarChar, userId)
        .input('NewLevel', sql.Int, newLevel)
        .input('NewExperiencePoints', sql.Int, newTotalXp)
        .input('NewStage', sql.NVarChar, newStage)
        .query(`
            UPDATE UserCatfish
            SET 
                Level = @NewLevel,
                ExperiencePoints = @NewExperiencePoints,
                Stage = @NewStage,
                UpdatedAt = GETUTCDATE()
            WHERE UserId = @UserId;
        `);

    await transaction.commit();
    console.log(`User ${userId} updated. Level: ${newLevel}, XP: ${newTotalXp}, Stage: ${newStage}`);

  } catch (error) {
    await transaction.rollback();
    console.error('Error updating user catfish experience:', error);
    throw error;
  }
}
