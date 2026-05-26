# SmartTuter Backend

## Overview
Backend service for the SmartTuter project. This README defines the intended folder structure and the purpose of each major area.

## Planned Folder Structure
```
backend/
├── config/
│   ├── db.config.js          # Database configuration
│   └── env.config.js         # Environment variables configuration
│
├── controllers/
│   ├── auth.controller.js    # Authentication controller
│   └── booking.controller.js # Booking-related logic
│
├── middleware/
│   ├── auth.middleware.js    # Middleware to protect routes
│   └── error.middleware.js   # Global error handling
│
├── models/
│   ├── user.model.js         # User schema and model
│   └── booking.model.js      # Booking schema and model
│
├── routes/
│   ├── auth.routes.js        # Authentication routes
│   └── booking.routes.js     # Booking routes
│
├── services/
│   └── email.service.js      # Email service to send notifications
│
├── utils/
│   ├── email.utils.js        # Email utilities
│   └── logger.js             # Logger configuration
│
├── views/
│   └── emails/
│       └── resetPassword.html # Email template for password reset
│
├── .env                       # Environment variables
├── .gitignore                 # Files to be ignored by Git
├── .prettierrc                # Prettier configuration for code formatting
├── app.js                     # Main application entry point
├── server.js                  # Express server setup
└── package.json               # Project dependencies
```

## Notes
- The structure above is the target layout for the backend codebase.
- Update this file as the structure evolves.
