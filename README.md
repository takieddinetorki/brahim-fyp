# Healthcare Management System Backend

A robust backend system for managing healthcare services, built with Node.js, Express, and SQLite.

## Features

- User Authentication (JWT)
- Role-based Access Control
- Appointment Management
- Medical Records Management
- Secure Messaging System
- Test Results Management

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following variables:
   ```
   PORT=3000
   NODE_ENV=development
   JWT_SECRET=your-secret-key
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- POST `/api/auth/register` - Register a new user
- POST `/api/auth/login` - Login user

### Users
- GET `/api/users` - Get all users (Admin only)
- GET `/api/users/:id` - Get user by ID
- PUT `/api/users/:id` - Update user
- DELETE `/api/users/:id` - Delete user (Admin only)

### Appointments
- GET `/api/appointments` - Get all appointments
- POST `/api/appointments` - Create new appointment
- PUT `/api/appointments/:id` - Update appointment
- DELETE `/api/appointments/:id` - Cancel appointment

### Medical Records
- GET `/api/medical-records` - Get medical records
- POST `/api/medical-records` - Create medical record
- PUT `/api/medical-records/:id` - Update medical record

### Messages
- GET `/api/messages` - Get messages
- POST `/api/messages` - Send message
- PUT `/api/messages/:id` - Mark message as read

## Database Schema

The system uses SQLite with the following main tables:
- users
- appointments
- medical_records
- messages
- test_results

## Security

- JWT Authentication
- Password Hashing with bcrypt
- Role-based Access Control
- Input Validation
- SQL Injection Prevention

## Error Handling

The API uses a consistent error response format:
```json
{
  "status": "error",
  "message": "Error message",
  "error": "Detailed error (development only)"
}
```

## Development

To run the development server with hot reload:
```bash
npm run dev
```

## Production

To run the production server:
```bash
npm start
``` 