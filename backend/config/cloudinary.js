const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Profile photos storage
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'chrischat/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
    resource_type: 'auto',
    transformation: [{ width: 800, height: 1000, crop: 'limit', quality: 'auto' }],
  },
});

// Chat media storage
const chatStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'chrischat/chat',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'mov', 'avi', 'm4a', 'mp3', 'aac', 'wav', 'ogg'],
    resource_type: 'auto',
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

const chatUpload = multer({
  storage: chatStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = { cloudinary, profileUpload, chatUpload };
