const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
const logosDir = path.join(uploadsDir, 'logos');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

if (!fs.existsSync(logosDir)) {
  fs.mkdirSync(logosDir, { recursive: true });
}

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with company ID and timestamp
    const companyId = req.user?.companyId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `logo-${companyId}-${timestamp}${ext}`;
    cb(null, filename);
  }
});

// File filter for logos (only images)
const fileFilter = (req, file, cb) => {
  // Check if file is an image
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for company logo'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Middleware for single logo upload
const uploadLogo = upload.single('logo');

// Error handling middleware
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        status: 'fail',
        message: 'File too large. Maximum size is 5MB.'
      });
    }
    return res.status(400).json({
      status: 'fail',
      message: 'File upload error: ' + error.message
    });
  } else if (error) {
    return res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
  next();
};

module.exports = {
  uploadLogo,
  handleUploadError
}; 