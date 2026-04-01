const Groq = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

/**
 * Generate quiz questions using Groq AI
 * @param {Object} params - Quiz parameters
 * @param {string} params.title - Quiz title
 * @param {string} params.category - Quiz category name
 * @param {string} params.difficulty - Quiz difficulty (easy, medium, hard)
 * @param {number} [params.count=5] - Number of questions to generate
 * @returns {Promise<Array>} Array of generated questions
 */
const generateQuestions = async ({ title, category, difficulty, count = 5 }) => {
    try {
        if (!process.env.GROQ_API_KEY) {
            throw new Error('GROQ_API_KEY is not configured in environment variables');
        }

        const prompt = `
            You are an expert quiz creator. Create a high-quality quiz with ${count} multiple-choice questions.
            
            Topic: ${title}
            Category: ${category}
            Difficulty: ${difficulty}
            
            Requirements:
            1. Each question must have exactly 4 options.
            2. Exactly one option must be correct.
            3. The response must be a valid JSON array of objects.
            4. Each object must have this structure:
               {
                 "questionText": "The question here?",
                 "options": [
                   { "text": "Option 1", "isCorrect": true },
                   { "text": "Option 2", "isCorrect": false },
                   { "text": "Option 3", "isCorrect": false },
                   { "text": "Option 4", "isCorrect": false }
                 ]
               }
            5. Provide ONLY the JSON array, no other text or explanation.
        `;

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a quiz generation assistant that outputs only valid JSON arrays."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 1,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: false,
            stop: null
        });

        let content = completion.choices[0]?.message?.content || '';
        
        // Find the JSON array or object in the response
        const jsonMatch = content.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
        if (jsonMatch) {
            content = jsonMatch[0];
        } else {
            // Fallback for cases without clear markers
            content = content.replace(/^```json/, '').replace(/```$/, '').trim();
        }

        const parsedData = JSON.parse(content);
        
        // Handle cases where AI might wrap the array in an object
        const questions = Array.isArray(parsedData) ? parsedData : (parsedData.questions || Object.values(parsedData)[0]);

        if (!Array.isArray(questions)) {
            throw new Error('AI returned an invalid format: expected an array of questions');
        }

        return questions;
    } catch (error) {
        console.error('Error generating questions with Groq:', error);
        throw error;
    }
};

module.exports = {
    generateQuestions
};
