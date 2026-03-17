const Category = require('../models/Category');

/**
 * Category Controller
 * Handles category CRUD operations
 */

// =============================================================================
// GET ALL CATEGORIES
// =============================================================================

/**
 * Get all categories
 * GET /api/categories
 */
const getCategories = async (req, res) => {
    try {
        const { active } = req.query;
        
        let query = {};
        if (active === 'true') {
            query.isActive = true;
        }
        
        const categories = await Category.find(query)
            .populate('createdBy', 'name')
            .sort({ name: 1 });
        
        res.json({
            categories
        });
        
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            error: 'Failed to get categories'
        });
    }
};

// =============================================================================
// GET SINGLE CATEGORY
// =============================================================================

/**
 * Get category by ID
 * GET /api/categories/:id
 */
const getCategoryById = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id)
            .populate('createdBy', 'name');
        
        if (!category) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }
        
        res.json({
            category
        });
        
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({
            error: 'Failed to get category'
        });
    }
};

// =============================================================================
// CREATE CATEGORY (Admin only)
// =============================================================================

/**
 * Create new category
 * POST /api/categories
 */
const createCategory = async (req, res) => {
    try {
        const { name, description, icon, color } = req.body;
        
        // Check if category already exists
        const existing = await Category.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });
        
        if (existing) {
            return res.status(400).json({
                error: 'A category with this name already exists'
            });
        }
        
        const category = new Category({
            name,
            description,
            icon: icon || 'folder',
            color: color || '#6366f1',
            createdBy: req.userId
        });
        
        await category.save();
        
        res.status(201).json({
            message: 'Category created successfully',
            category
        });
        
    } catch (error) {
        console.error('Create category error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                error: 'A category with this name already exists'
            });
        }
        
        res.status(500).json({
            error: 'Failed to create category'
        });
    }
};

// =============================================================================
// UPDATE CATEGORY (Admin only)
// =============================================================================

/**
 * Update category
 * PUT /api/categories/:id
 */
const updateCategory = async (req, res) => {
    try {
        const { name, description, icon, color, isActive } = req.body;
        
        const category = await Category.findById(req.params.id);
        
        if (!category) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }
        
        // Check for duplicate name (if changing name)
        if (name && name !== category.name) {
            const existing = await Category.findOne({ 
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                _id: { $ne: category._id }
            });
            
            if (existing) {
                return res.status(400).json({
                    error: 'A category with this name already exists'
                });
            }
        }
        
        // Update fields
        if (name) category.name = name;
        if (description !== undefined) category.description = description;
        if (icon) category.icon = icon;
        if (color) category.color = color;
        if (typeof isActive === 'boolean') category.isActive = isActive;
        
        await category.save();
        
        res.json({
            message: 'Category updated successfully',
            category
        });
        
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({
            error: 'Failed to update category'
        });
    }
};

// =============================================================================
// DELETE CATEGORY (Admin only)
// =============================================================================

/**
 * Delete category
 * DELETE /api/categories/:id
 */
const deleteCategory = async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        
        if (!category) {
            return res.status(404).json({
                error: 'Category not found'
            });
        }
        
        // Check if any quizzes are using this category
        const Quiz = require('../models/Quiz');
        const quizCount = await Quiz.countDocuments({ category: category._id });
        
        if (quizCount > 0) {
            return res.status(400).json({
                error: `Cannot delete category. ${quizCount} quiz(es) are using this category.`
            });
        }
        
        await Category.findByIdAndDelete(req.params.id);
        
        res.json({
            message: 'Category deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({
            error: 'Failed to delete category'
        });
    }
};

// =============================================================================
// SEED DEFAULT CATEGORIES (Admin only)
// =============================================================================

/**
 * Seed default categories
 * POST /api/categories/seed
 */
const seedCategories = async (req, res) => {
    try {
        const defaultCategories = [
            { name: 'General Knowledge', description: 'Test your general knowledge', icon: 'brain', color: '#8b5cf6' },
            { name: 'Mathematics', description: 'Mathematical problems and puzzles', icon: 'calculator', color: '#3b82f6' },
            { name: 'Science', description: 'Physics, Chemistry, Biology', icon: 'flask-conical', color: '#10b981' },
            { name: 'History', description: 'World history and events', icon: 'landmark', color: '#f59e0b' },
            { name: 'Geography', description: 'Countries, capitals, and maps', icon: 'globe', color: '#06b6d4' },
            { name: 'Programming', description: 'Coding and software development', icon: 'code', color: '#6366f1' },
            { name: 'English', description: 'Grammar, vocabulary, literature', icon: 'book-open', color: '#ec4899' },
            { name: 'Aptitude', description: 'Logical reasoning and aptitude', icon: 'lightbulb', color: '#f97316' }
        ];
        
        let created = 0;
        let skipped = 0;
        
        for (const cat of defaultCategories) {
            const exists = await Category.findOne({ name: cat.name });
            if (!exists) {
                await Category.create({
                    ...cat,
                    createdBy: req.userId
                });
                created++;
            } else {
                skipped++;
            }
        }
        
        res.json({
            message: `Categories seeded. Created: ${created}, Skipped (already exist): ${skipped}`
        });
        
    } catch (error) {
        console.error('Seed categories error:', error);
        res.status(500).json({
            error: 'Failed to seed categories'
        });
    }
};

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    seedCategories
};
