const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const Category = require('../models/Category');

/**
 * @route   POST /api/ai/generate-questions
 * @desc    Generate quiz questions using AI
 * @access  Private
 */
router.post('/generate-questions', async (req, res) => {
    try {
        const { title, categoryId, categoryName, difficulty, count } = req.body;

        if (!title) {
            return res.status(400).json({ error: 'Quiz title is required' });
        }

        let name = categoryName;
        
        // If only categoryId is provided, fetch the name
        if (categoryId && !name) {
            const category = await Category.findById(categoryId);
            if (category) {
                name = category.name;
            }
        }

        const questions = await aiService.generateQuestions({
            title,
            category: name || 'General',
            difficulty: difficulty || 'medium',
            count: count || 5
        });

        res.json({ questions });
    } catch (error) {
        console.error('AI Generation Route Error:', error);
        res.status(500).json({ 
            error: 'Failed to generate questions. Please check if GROQ_API_KEY is properly configured.',
            details: error.message 
        });
    }
});

module.exports = router;
