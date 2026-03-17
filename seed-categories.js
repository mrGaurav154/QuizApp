const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Category = require('./server/models/Category');
const User = require('./server/models/User');

async function seedAndVerify() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Get a user or create a system user for seeding
        let user = await User.findOne({ role: 'admin' });
        if (!user) user = await User.findOne();
        if (!user) {
            console.log('No user found to assign as creator. Please register a user first.');
            process.exit(1);
        }

        console.log(`Using user: ${user.name} (${user._id}) as creator`);

        // 2. Default categories
        const defaultCategories = [
            { name: 'General Knowledge', description: 'Test your general knowledge', icon: 'brain', color: '#8b5cf6' },
            { name: 'Mathematics', description: 'Mathematical problems and puzzles', icon: 'calculator', color: '#3b82f6' },
            { name: 'Science', description: 'Physics, Chemistry, Biology', icon: 'flask-conical', color: '#10b981' },
            { name: 'History', description: 'World history and events', icon: 'landmark', color: '#f59e0b' },
            { name: 'Geography', description: 'Countries, capitals, and maps', icon: 'globe', color: '#06b6d4' },
            { name: 'Programming', description: 'Coding and software development', icon: 'code', color: '#6366f1' },
            { name: 'English', description: 'Grammar, vocabulary, literature', icon: 'book-open', color: '#ec4899' },
            { name: 'Aptitude', description: 'Logical reasoning and aptitude', icon: 'lightbulb', color: '#f97316' },
            { name: 'Computer Science', description: 'CS fundamentals and logic', icon: 'cpu', color: '#6366f1' }
        ];

        let createdCount = 0;
        for (const cat of defaultCategories) {
            const exists = await Category.findOne({ 
                name: { $regex: new RegExp(`^${cat.name}$`, 'i') } 
            });
            if (!exists) {
                await Category.create({ ...cat, createdBy: user._id });
                console.log(`Created category: ${cat.name}`);
                createdCount++;
            } else {
                console.log(`Category exists: ${cat.name}`);
            }
        }

        console.log(`\nSeeding complete. Created ${createdCount} categories.`);
        
        const allCats = await Category.find();
        console.log('\nAll categories currently in DB:');
        allCats.forEach(c => console.log(`- ${c.name}`));

        await mongoose.connection.close();
    } catch (err) {
        console.error('Error:', err);
    }
}

seedAndVerify();
