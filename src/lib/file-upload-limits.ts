/** Max upload size for chat attachments (5 MB). */
export const MAX_UPLOAD_FILE_BYTES = 5 * 1024 * 1024;

export const MAX_UPLOAD_FILE_MB = MAX_UPLOAD_FILE_BYTES / (1024 * 1024);

/** Profile photo — must match gdc-backend middleware/upload (multer) limit. */
export const PROFILE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export const PROFILE_IMAGE_MAX_MB = PROFILE_IMAGE_MAX_BYTES / (1024 * 1024);
