# CrewMate GenAI

This repository contains the CrewMate GenAI application components.

## Structure

```
crewmate_GenAI/
├── frontend/           # Node.js Express backend server application
│   ├── config/         # Database and authentication configuration
│   ├── controllers/    # API controllers for handling requests
│   ├── middlewares/    # Express middleware functions
│   ├── models/         # Database models (MongoDB/Mongoose)
│   ├── routes/         # API route definitions
│   ├── node_modules/   # Node.js dependencies
│   ├── package.json    # Node.js project configuration
│   ├── package-lock.json
│   └── server.js       # Main server entry point
└── README.md           # This file
```

## Getting Started

### Frontend (Backend Server)

The main Node.js Express application is located in the `frontend/` directory.

1. Navigate to the frontend directory:
   ```bash
   cd frontend/
   ```

2. Install dependencies (if not already installed):
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Create a `.env` file in the `frontend/` directory
   - Set required environment variables (MONGO_URI, JWT_SECRET, etc.)

4. Start the development server:
   ```bash
   npm start
   ```

The server will start on the port specified in your environment variables.

## API Endpoints

- `/auth/*` - Authentication routes (Google OAuth)
- `/api/*` - Chat and general API routes  
- `/api/messages/*` - Message handling routes

## Technologies Used

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js with Google OAuth 2.0
- **File Processing**: Mammoth, PDF-Parse, Textract
- **Other**: CORS, JWT, Cookie-Parser