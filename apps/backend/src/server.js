require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser'); // Import cookie-parser
const cors = require('cors'); // Add this line
const path = require('path'); // Add this for static file serving

// --- Route Imports ---
const authRoutes = require('./routes/authRoutes');
const companyRoutes = require('./routes/companyRoutes');
const staffRoutes = require('./routes/staffRoutes'); // Added staff routes
const roleRoutes = require('./routes/roleRoutes');   // Added role routes
const settingsRoutes = require('./routes/settingsRoutes'); // Import settings routes
const clientRoutes = require('./routes/clientRoutes'); // Adjust path if necessary
const inventoryRoutes = require('./routes/inventoryRoutes'); // Import inventory routes
const batchInventoryRoutes = require('./routes/batchInventoryRoutes'); // NEW: Import batch inventory routes
const productRoutes = require('./routes/productRoutes'); // Import product routes
const estimationRoutes = require('./routes/estimationRoutes');
const quotationRoutes = require('./routes/quotationRoutes'); // Import quotation routes
const orderRoutes = require('./routes/orderRoutes'); // Import order routes
const manufacturingRoutes = require('./routes/manufacturingRoutes'); // Import manufacturing routes
const invoiceRoutes = require('./routes/invoiceRoutes'); // Import invoice routes
const accountingRoutes = require('./routes/accountingRoutes'); // Import accounting routes
const reportRoutes = require('./routes/reportRoutes'); // Import report routes
// Add other route imports here (e.g., clientRoutes, productRoutes)

const app = express();
const port = process.env.PORT || 3001;
const mongoUri = process.env.MONGO_URI;

// --- Core Middleware ---
// Add this CORS configuration BEFORE other middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies BEFORE your routes that need them

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// --- Database Connection ---
if (!mongoUri) {
  console.error('FATAL ERROR: MONGO_URI is not defined.');
  process.exit(1);
}

mongoose.connect(mongoUri)
  .then(() => console.log('MongoDB connected successfully.'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Exit if cannot connect to DB
  });

// --- API Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/staff', staffRoutes);     // Mounted staff routes
app.use('/api/roles', roleRoutes);       // Mounted role routes
app.use('/api/settings', settingsRoutes); // Mount settings routes
app.use('/api/clients', clientRoutes);
app.use('/api/inventory', inventoryRoutes); // Mount inventory routes 
app.use('/api/v2/inventory', batchInventoryRoutes); // NEW: Mount batch inventory routes (v2)
app.use('/api/products', productRoutes); // Mount product routes
app.use('/api/estimations', estimationRoutes);
app.use('/api/quotations', quotationRoutes); // Mount quotation routes
app.use('/api/orders', orderRoutes); // Mount order routes
app.use('/api/manufacturing', manufacturingRoutes); // Mount manufacturing routes
app.use('/api/invoices', invoiceRoutes); // Mount invoice routes
app.use('/api/accounting', accountingRoutes); // Mount accounting routes
app.use('/api/reports', reportRoutes); // Mount report routes
// Mount other routes here:
// app.use('/api/clients', clientRoutes);
// app.use('/api/products', productRoutes);

// --- Basic Root Route ---
app.get('/', (req, res) => {
  res.send('Aluminium Window App Backend API - Root');
});

// --- Global Error Handling Middleware ---
// Add a more specific error handler later if needed
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err.message); // Log message for brevity, stack for details if needed
  if (err.stack) {
    console.error("Global Error Handler Stack:", err.stack);
  }

  // If headers have already been sent, delegate to the default Express error handler
  // This is crucial for cases where an error occurs mid-stream (e.g., during PDF generation)
  if (res.headersSent) {
    console.warn("[GlobalErrorHandler] Headers already sent, delegating to default Express handler.");
    return next(err);
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  const errorResponse = {
    status: err.status,
    message: err.message || 'Something went wrong!'
  };
  // Optionally include stack trace in development
  // if (process.env.NODE_ENV === 'development') {
  //   errorResponse.stack = err.stack;
  // }

  res.status(err.statusCode).json(errorResponse);
});

// --- Start Server ---
const server = app.listen(port, () => {
  console.log(`Backend server attempting to listen on port ${port}`);
  console.log(`MongoDB URI used: ${mongoUri ? mongoUri.substring(0, mongoUri.indexOf(':', 10) + 1) + '****' + mongoUri.substring(mongoUri.lastIndexOf('@')) : 'Not Defined'}`); // Basic masking for logging
  console.log(`Frontend URL for CORS: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`Backend server listening on port ${port}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log('Mongoose default connection disconnected through app termination');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.error('UNHANDLED REJECTION! Shutting down...', err);
    // Close server & exit process
    server.close(() => process.exit(1));
}); 