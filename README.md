# QuizCraft - Online Quiz Application

A modern, teacher-first online quiz platform built with Node.js, Express, MongoDB, and vanilla JavaScript.

## Features

- 🔐 **Secure Authentication** - JWT-based auth with access & refresh tokens
- 👥 **Role-Based Access** - Admin, Teacher, and Student roles
- 📝 **Quiz Management** - Create, edit, and manage quizzes
- ⏱️ **Timed Quizzes** - Auto-submit on timeout
- 📊 **Analytics** - Track results and performance
- 🎨 **Modern UI** - Clean, professional SaaS design

## Tech Stack

- **Frontend**: HTML, Tailwind CSS, Vanilla JavaScript
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (Access + Refresh tokens)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (local or Atlas)

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update MongoDB URI and JWT secrets

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

## Project Structure

```
├── server/
│   ├── config/        # Database configuration
│   ├── controllers/   # Route handlers
│   ├── middleware/    # Auth, validation, etc.
│   ├── models/        # Mongoose schemas
│   ├── routes/        # API routes
│   └── utils/         # Helper functions
├── public/
│   ├── css/           # Stylesheets
│   ├── js/            # Frontend JavaScript
│   └── *.html         # HTML pages
└── package.json
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout

### Quizzes

- `GET /api/quizzes` - List quizzes
- `POST /api/quizzes` - Create quiz
- `GET /api/quizzes/:id` - Get quiz
- `PUT /api/quizzes/:id` - Update quiz
- `DELETE /api/quizzes/:id` - Delete quiz

### Categories

- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (Admin)
- `PUT /api/categories/:id` - Update category (Admin)
- `DELETE /api/categories/:id` - Delete category (Admin)

## License

MIT
