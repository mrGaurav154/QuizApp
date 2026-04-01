const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Groq = require('groq-sdk');

async function testGroq() {
    console.log('=== Groq AI Integration Test ===\n');

    // Check API key
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === 'your_groq_api_key_here') {
        console.error('❌ GROQ_API_KEY is not set or is still the placeholder.');
        console.error('   Please add your real Groq API key to the .env file:');
        console.error('   GROQ_API_KEY=gsk_your_actual_key_here');
        process.exit(1);
    }
    console.log('✅ GROQ_API_KEY detected:', apiKey.substring(0, 8) + '...');

    // Test the API
    try {
        const groq = new Groq({ apiKey });

        console.log('\n📡 Sending test request to Groq (model: llama-3.3-70b-versatile)...\n');

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: "You are a quiz generation assistant that outputs only valid JSON arrays."
                },
                {
                    role: "user",
                    content: `Create 2 multiple-choice questions about JavaScript basics. 
                    Return ONLY a JSON array with this structure:
                    [{ "questionText": "...", "options": [{ "text": "...", "isCorrect": true/false }] }]
                    Each question must have exactly 4 options with exactly 1 correct.`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 1,
            max_completion_tokens: 8192,
            top_p: 1,
            stream: false,
            stop: null
        });

        const content = completion.choices[0]?.message?.content;
        console.log('📝 Raw AI Response:\n');
        console.log(content);
        
        // Try parsing
        let cleaned = content;
        if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
        } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
        }

        const parsed = JSON.parse(cleaned);
        const questions = Array.isArray(parsed) ? parsed : (parsed.questions || Object.values(parsed)[0]);

        console.log('\n\n✅ SUCCESS! Parsed', questions.length, 'questions:\n');
        questions.forEach((q, i) => {
            console.log(`  Q${i + 1}: ${q.questionText}`);
            q.options.forEach((opt, j) => {
                const marker = opt.isCorrect ? '✅' : '  ';
                console.log(`    ${marker} ${String.fromCharCode(65 + j)}) ${opt.text}`);
            });
            console.log('');
        });

        console.log('🎉 Groq AI integration is working perfectly!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.status === 401) {
            console.error('   Your API key is invalid. Please check it on https://console.groq.com');
        }
        process.exit(1);
    }
}

testGroq();
