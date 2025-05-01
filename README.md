# EGAM Agency CRM
A comprehensive CRM system for EGAM agency to manage projects, proposals, invoices, and clients.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Environment Setup](#environment-setup)
3. [Getting Started](#getting-started)
4. [API Documentation](#api-documentation)
5. [Data Models](#data-models)
6. [Advanced API Features](#advanced-api-features)
7. [Error Handling](#error-handling)

## Project Structure

```
d:\FREELANCING\EGMA\Egam Prm\
├── config/               # Configuration files
│   └── db.js             # Database connection
├── controllers/          # Logic for handling API requests
│   ├── projectController.js
│   ├── invoiceController.js
│   └── proposalController.js
├── middleware/           # Custom middleware
│   └── errorMiddleware.js # Global error handling
├── models/               # Database models
│   ├── Project.js
│   ├── Invoice.js
│   └── Proposal.js
├── routes/               # API route definitions
│   ├── projectRoutes.js
│   ├── invoiceRoutes.js
│   └── proposalRoutes.js
├── utils/                # Utility functions
│   ├── asyncHandler.js   # Async request handler wrapper
│   ├── errorResponse.js  # Custom error response class
│   └── routeUtils.js     # Route utility functions
├── .env                  # Environment variables
├── index.js              # Application entry point
└── package.json          # Project dependencies
```

## Environment Setup

Create a `.env` file in the root directory with the following variables:

```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/egam-crm
JWT_SECRET=your-jwt-secret-key-change-this
NODE_ENV=development
```

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables in `.env` file
4. Start the development server:
   ```
   npm run dev
   ```
5. The API will be available at `http://localhost:5000`

## API Documentation

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Get all projects (with filtering) |
| GET | `/api/projects/:id` | Get a specific project |
| POST | `/api/projects` | Create a new project |
| PUT | `/api/projects/:id` | Update a project |
| DELETE | `/api/projects/:id` | Delete a project |

### Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | Get all invoices (with filtering) |
| GET | `/api/invoices/:id` | Get a specific invoice |
| POST | `/api/invoices` | Create a new invoice |
| PUT | `/api/invoices/:id` | Update an invoice |
| DELETE | `/api/invoices/:id` | Delete an invoice |

### Proposals

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proposals` | Get all proposals (with filtering) |
| GET | `/api/proposals/:id` | Get a specific proposal |
| POST | `/api/proposals` | Create a new proposal |
| PUT | `/api/proposals/:id` | Update a proposal |
| DELETE | `/api/proposals/:id` | Delete a proposal |

## Data Models

### Project Model

```javascript
{
  name: String,              // Required
  client: {
    name: String,            // Required
    email: String,           // Required
    phone: String            // Required
  },
  proposal: {
    id: ObjectId,            // References Proposal model
    status: String,          // Enum: not_sent, sent, accepted, rejected, needs_revision
    sentDate: Date
  },
  invoiceId: ObjectId,       // References Invoice model
  status: String,            // Enum: pending, in-progress, completed, on-hold, cancelled
  startDate: Date,           // Required
  endDate: Date,
  totalBudget: Number,       // Required
  amountReceived: Number,
  description: String,
  priority: String,          // Enum: low, medium, high
  createdAt: Date,
  updatedAt: Date
}
```

### Invoice Model

```javascript
{
  projectId: ObjectId,       // Required, References Project model
  invoiceNumber: String,     // Required, Unique
  clientDetails: {
    name: String,            // Required
    email: String,           // Required
    phone: String,           // Required
    address: String          // Required
  },
  items: [{
    description: String,     // Required
    quantity: Number,        // Required
    rate: Number,            // Required
    amount: Number           // Required
  }],
  subtotal: Number,          // Required
  tax: Number,
  discount: Number,
  total: Number,             // Required
  status: String,            // Enum: draft, sent, paid, overdue, cancelled
  issueDate: Date,
  dueDate: Date,             // Required
  paymentDate: Date,
  notes: String,
  terms: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Proposal Model

```javascript
{
  projectId: ObjectId,       // References Project model
  clientDetails: {
    name: String,            // Required
    email: String,           // Required
    phone: String,           // Required
    address: String
  },
  proposalNumber: String,    // Required, Unique
  title: String,             // Required
  description: String,       // Required
  scope: String,             // Required
  deliverables: [String],
  timeline: String,          // Required
  budgetEstimate: Number,    // Required
  terms: String,
  status: String,            // Enum: draft, sent, accepted, rejected, negotiating
  sentDate: Date,
  expiryDate: Date,
  decisionDate: Date,
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Advanced API Features

### Filtering

Filter any field using URL query parameters:

```
/api/projects?status=in-progress
/api/projects?priority=high
/api/invoices?status=paid
```

### Advanced Filtering

Use comparison operators by appending them to the field name:

```
/api/projects?totalBudget[gt]=50000
/api/invoices?dueDate[lt]=2023-07-01
```

Supported operators:
- `gt`: Greater than
- `gte`: Greater than or equal to
- `lt`: Less than
- `lte`: Less than or equal to
- `in`: Included in an array

### Selecting Fields

Select only specific fields to return:

```
/api/projects?select=name,status,client,totalBudget
```

### Sorting

Sort results by any field (prefix with `-` for descending order):

```
/api/projects?sort=totalBudget,-priority
```

### Pagination

Paginate results:

```
/api/projects?page=2&limit=10
```

## Error Handling

The API uses a consistent error response format:

```json
{
  "success": false,
  "error": "Error message details"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Resource created
- `400`: Bad request (validation error, etc.)
- `404`: Resource not found
- `500`: Server error

## Examples

### Creating a Project

**Request:**
```
POST /api/projects
Content-Type: application/json

{
  "name": "E-commerce Website Redesign",
  "client": {
    "name": "ABC Retail Solutions",
    "email": "contact@abcretail.com",
    "phone": "+91 9876543210"
  },
  "proposal": {
    "status": "sent",
    "sentDate": "2023-06-15T10:30:00.000Z"
  },
  "status": "pending",
  "startDate": "2023-07-01T00:00:00.000Z",
  "endDate": "2023-08-15T00:00:00.000Z",
  "totalBudget": 75000,
  "amountReceived": 25000,
  "description": "Complete redesign of the client's e-commerce platform with improved UX/UI, mobile responsiveness, and integration of payment gateways.",
  "priority": "high"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "60d21b4667d0d8992e610c85",
    "name": "E-commerce Website Redesign",
    "client": {
      "name": "ABC Retail Solutions",
      "email": "contact@abcretail.com",
      "phone": "+91 9876543210"
    },
    "proposal": {
      "status": "sent",
      "sentDate": "2023-06-15T10:30:00.000Z"
    },
    "status": "pending",
    "startDate": "2023-07-01T00:00:00.000Z",
    "endDate": "2023-08-15T00:00:00.000Z",
    "totalBudget": 75000,
    "amountReceived": 25000,
    "description": "Complete redesign of the client's e-commerce platform with improved UX/UI, mobile responsiveness, and integration of payment gateways.",
    "priority": "high",
    "createdAt": "2023-06-23T14:48:22.123Z",
    "updatedAt": "2023-06-23T14:48:22.123Z"
  }
}
```
#   E G M A - C R M - b a c k e n d - 
 
 