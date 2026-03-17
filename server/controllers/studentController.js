const { Student, Quiz } = require('../models');

/**
 * Create student profile
 * POST /api/students/create
 */
exports.createStudent = async (req, res) => {
    try {
        const { name, email, avatar, className } = req.body;
        
        // Validate required fields
        if (!name || !email || !avatar) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, and avatar are required'
            });
        }
        
        // Check if student already exists
        let student = await Student.findByEmail(email);
        
        if (student) {
            // Update existing student
            student.name = name;
            student.avatar = avatar;
            student.className = className || '';
            await student.save();
            
            return res.status(200).json({
                success: true,
                message: 'Student profile updated',
                data: student.toPublicProfile()
            });
        }
        
        // Create new student
        student = new Student({
            name,
            email,
            avatar,
            className: className || ''
        });
        
        await student.save();
        
        res.status(201).json({
            success: true,
            message: 'Student profile created successfully',
            data: student.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Create student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create student profile',
            error: error.message
        });
    }
};

/**
 * Verify quiz code and get quiz info
 * POST /api/students/verify-code
 */
exports.verifyQuizCode = async (req, res) => {
    try {
        const { code } = req.body;
        
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Quiz code is required'
            });
        }
        
        // Find quiz by access code
        const quiz = await Quiz.findOne({ 
            accessCode: code.toUpperCase(),
            isPublished: true 
        })
        .populate('category', 'name icon color')
        .populate('createdBy', 'name');
        
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Invalid quiz code or quiz not found'
            });
        }
        
        res.json({
            success: true,
            data: {
                id: quiz._id,
                title: quiz.title,
                description: quiz.description,
                category: quiz.category,
                difficulty: quiz.difficulty,
                timeLimit: quiz.timeLimit,
                questionCount: quiz.questionCount,
                createdBy: quiz.createdBy.name
            }
        });
        
    } catch (error) {
        console.error('Verify code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify quiz code',
            error: error.message
        });
    }
};

/**
 * Get all students for a specific quiz
 * GET /api/students/quiz/:quizId
 */
exports.getStudentsByQuiz = async (req, res) => {
    try {
        const { quizId } = req.params;
        
        // Verify quiz exists and user is the creator
        const quiz = await Quiz.findById(quizId);
        
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        // Only allow quiz creator to see students
        if (quiz.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to view students for this quiz'
            });
        }
        
        // Get students who took this quiz
        const students = await Student.getByQuiz(quizId);
        
        res.json({
            success: true,
            data: students
        });
        
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch students',
            error: error.message
        });
    }
};

/**
 * Get all students for a teacher
 * GET /api/students/teacher
 */
exports.getStudentsByTeacher = async (req, res) => {
    try {
        const teacherId = req.user._id;
        
        const students = await Student.getByTeacher(teacherId);
        
        res.json({
            success: true,
            count: students.length,
            data: students
        });
        
    } catch (error) {
        console.error('Get teacher students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch students',
            error: error.message
        });
    }
};

/**
 * Get student by email
 * GET /api/students/email/:email
 */
exports.getStudentByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        
        const student = await Student.findByEmail(email);
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }
        
        res.json({
            success: true,
            data: student.toPublicProfile()
        });
        
    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch student',
            error: error.message
        });
    }
};

/**
 * Join quiz as student
 * POST /api/students/join-quiz
 */
exports.joinQuiz = async (req, res) => {
    try {
        const { quizId, studentEmail } = req.body;
        
        if (!quizId || !studentEmail) {
            return res.status(400).json({
                success: false,
                message: 'Quiz ID and student email are required'
            });
        }
        
        // Find quiz and student
        const quiz = await Quiz.findById(quizId);
        const student = await Student.findByEmail(studentEmail);
        
        if (!quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found. Please create profile first.'
            });
        }
        
        // Add student to quiz if not already added
        if (!quiz.students.includes(student._id)) {
            quiz.students.push(student._id);
            await quiz.save();
        }
        
        // Add quiz to student's history
        await student.addQuiz(quizId, quiz.createdBy);
        
        res.json({
            success: true,
            message: 'Successfully joined quiz',
            data: {
                quizId: quiz._id,
                studentId: student._id
            }
        });
        
    } catch (error) {
        console.error('Join quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to join quiz',
            error: error.message
        });
    }
};
