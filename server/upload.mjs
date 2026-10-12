/**
 * Photo Upload Handler
 * Handles file uploads with EXIF stripping, image optimization, and optional background removal
 * Now uses Neon Object Storage (S3-compatible) for production-ready file storage
 */

import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { query } from './db.mjs';
import { Files } from 'files-sdk';
import { neon } from 'files-sdk/neon';

// Neon Object Storage configuration
const storage = new Files({ 
  adapter: neon({ bucket: 'uploads' }) 
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// Background removal settings
const ENABLE_BACKGROUND_REMOVAL = process.env.REMOVE_BACKGROUND === 'true' || false;

/**
 * Remove background from image (simple white background removal)
 * For production, consider using Remove.bg API or AI-based solution
 */
async function removeBackground(imageBuffer) {
  try {
    // Get image metadata
    const metadata = await sharp(imageBuffer).metadata();
    
    // Convert to PNG with alpha channel for transparency
    const processedImage = await sharp(imageBuffer)
      .ensureAlpha()
      .png()
      .toBuffer();
    
    // Simple threshold-based background removal
    // This works best with white/light backgrounds
    const removed = await sharp(processedImage)
      .threshold(240, { greyscale: false }) // Adjust threshold as needed
      .negate({ alpha: false })
      .toBuffer();
    
    return removed;
  } catch (err) {
    console.error('Background removal failed:', err);
    // Return original image if removal fails
    return imageBuffer;
  }
}

/**
 * Parse multipart form data
 */
async function parseMultipartForm(req) {
  const type = String(req.headers['content-type'] || '');
  const match = type.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = (match?.[1] || match?.[2] || '').trim();
  if (!boundary) {
    throw new Error('No boundary found in content-type');
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  const parts = buffer.toString('binary').split(`--${boundary}`);

  const files = [];
  const fields = {};

  for (const part of parts) {
    if (!part.includes('Content-Disposition')) continue;
    const nameMatch = part.match(/name="([^"]+)"/);
    const filenameMatch = part.match(/filename="([^"]+)"/);
    const contentTypeMatch = part.match(/Content-Type:\s*(.+)/i);

    if (filenameMatch && contentTypeMatch) {
      const name = nameMatch?.[1] || 'file';
      const filename = filenameMatch[1];
      const contentType = contentTypeMatch[1].trim();
      const dataStart = part.indexOf('\r\n\r\n') + 4;
      const dataEnd = part.lastIndexOf('\r\n');
      const data = Buffer.from(part.slice(dataStart, dataEnd), 'binary');
      files.push({ name, filename, contentType, data });
    } else if (nameMatch) {
      const dataStart = part.indexOf('\r\n\r\n') + 4;
      const dataEnd = part.lastIndexOf('\r\n');
      fields[nameMatch[1]] = part.slice(dataStart, dataEnd);
    }
  }

  return { fields, files };
}

/**
 * Process and upload photo
 */
export async function uploadPhoto(req, listingId, userId) {
  try {
    // Parse multipart form
    const { fields, files } = await parseMultipartForm(req);

    if (!files || files.length === 0) {
      return { status: 400, body: { error: 'No file uploaded' } };
    }

    const file = files[0];

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.contentType)) {
      return { 
        status: 400, 
        body: { error: `Invalid file type. Allowed: ${ALLOWED_TYPES.join(', ')}` } 
      };
    }

    // Validate file size
    if (file.data.length > MAX_FILE_SIZE) {
      return { 
        status: 400, 
        body: { error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB` } 
      };
    }

    // Verify listing ownership
    const ownerCheck = await query(
      'SELECT seller_id FROM listings WHERE id = $1',
      [listingId]
    );

    if (!ownerCheck.rows[0] || ownerCheck.rows[0].seller_id !== userId) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    // Check if background removal is requested
    const removeBackground = fields.removeBackground === 'true' || ENABLE_BACKGROUND_REMOVAL;
    
    // Optionally remove background
    let imageData = file.data;
    let outputFormat = 'jpeg';
    
    if (removeBackground) {
      console.log('Removing background from image...');
      try {
        // Convert to PNG with transparency
        imageData = await sharp(file.data)
          .ensureAlpha()
          .png()
          .toBuffer();
        
        // Apply threshold-based background removal (works best with white backgrounds)
        imageData = await sharp(imageData)
          .threshold(240) // Remove pixels brighter than this (white background)
          .toBuffer();
        
        outputFormat = 'png'; // Must use PNG to preserve transparency
        console.log('Background removed successfully');
      } catch (err) {
        console.error('Background removal failed, using original:', err);
        imageData = file.data; // Fallback to original
        outputFormat = 'jpeg';
      }
    }

    // Process image with sharp (resize, optimize, strip EXIF)
    let processedImage;
    
    if (outputFormat === 'png') {
      processedImage = await sharp(imageData)
        .resize(1200, 1200, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .rotate() // Auto-rotate based on EXIF orientation
        .withMetadata({ 
          exif: {} // Remove all EXIF metadata (including GPS, camera info)
        })
        .png({ 
          quality: 90,
          compressionLevel: 9
        })
        .toBuffer();
    } else {
      processedImage = await sharp(imageData)
        .resize(1200, 1200, { 
          fit: 'inside', 
          withoutEnlargement: true 
        })
        .rotate() // Auto-rotate based on EXIF orientation
        .withMetadata({ 
          exif: {} // Remove all EXIF metadata (including GPS, camera info)
        })
        .jpeg({ 
          quality: 85, 
          mozjpeg: true // Better compression
        })
        .toBuffer();
    }

    // Generate thumbnail (always JPEG for smaller size)
    const thumbnail = await sharp(file.data)
      .resize(300, 300, { 
        fit: 'cover' 
      })
      .withMetadata({ exif: {} })
      .jpeg({ quality: 80 })
      .toBuffer();

    // Get image metadata
    const metadata = await sharp(processedImage).metadata();

    // Generate unique filename with correct extension
    const ext = outputFormat === 'png' ? 'png' : 'jpg';
    const filename = `${listingId}-${Date.now()}-${randomBytes(8).toString('hex')}.${ext}`;
    const thumbnailFilename = `thumb-${filename.replace(`.${ext}`, '.jpg')}`; // Thumbnail always JPEG

    // Upload to Neon Object Storage
    const contentType = outputFormat === 'png' ? 'image/png' : 'image/jpeg';
    
    await storage.upload(`listings/${filename}`, processedImage, { 
      contentType,
      cacheControl: 'public, max-age=31536000' // Cache for 1 year
    });
    
    await storage.upload(`listings/${thumbnailFilename}`, thumbnail, { 
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000'
    });

    // Generate public URLs (since bucket is public_read)
    const baseUrl = process.env.AWS_ENDPOINT_URL_S3 || '';
    const photoUrl = `${baseUrl}/uploads/listings/${filename}`;
    const thumbnailUrl = `${baseUrl}/uploads/listings/${thumbnailFilename}`;

    // Get current photo count to determine position
    const countResult = await query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM listing_photos WHERE listing_id = $1',
      [listingId]
    );
    const position = countResult.rows[0].next_pos;

    // Check if this should be primary (first photo)
    const isPrimary = position === 0;

    // Save to database
    const result = await query(
      `INSERT INTO listing_photos 
         (listing_id, url, thumbnail_url, position, width, height, size_bytes, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        listingId, 
        photoUrl, 
        thumbnailUrl,
        position, 
        metadata.width, 
        metadata.height, 
        processedImage.length,
        isPrimary
      ]
    );

    return {
      status: 201,
      body: {
        success: true,
        photo: result.rows[0],
        backgroundRemoved: removeBackground,
        format: outputFormat,
        message: removeBackground 
          ? 'Photo uploaded successfully with background removed'
          : 'Photo uploaded successfully'
      }
    };

  } catch (error) {
    console.error('Photo upload error:', error);
    return { 
      status: 500, 
      body: { error: 'Failed to upload photo', details: error.message } 
    };
  }
}

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function publicObjectUrl(key) {
  const baseUrl = String(process.env.AWS_ENDPOINT_URL_S3 || "").replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/uploads/${key}` : `/uploads/${key}`;
}

function storageKeyFromUrl(url, folder) {
  const value = String(url || "");
  const marker = `/uploads/${folder}/`;
  const idx = value.indexOf(marker);
  if (idx === -1) return null;
  const name = value.slice(idx + marker.length).split("?")[0];
  return name ? `${folder}/${name}` : null;
}

export async function uploadAvatar(req, userId) {
  try {
    const { files } = await parseMultipartForm(req);
    const file = files?.[0];
    if (!file) return { status: 400, body: { error: "Choose a photo to upload." } };
    if (!ALLOWED_TYPES.includes(file.contentType)) {
      return { status: 400, body: { error: "Use a JPG, PNG, or WebP image." } };
    }
    if (file.data.length > AVATAR_MAX_BYTES) {
      return { status: 400, body: { error: "Photo must be 5 MB or smaller." } };
    }

    const processed = await sharp(file.data)
      .rotate()
      .resize(512, 512, { fit: "cover" })
      .jpeg({ quality: 85, mozjpeg: true })
      .withMetadata({ exif: {} })
      .toBuffer();

    const filename = `${userId}-${Date.now()}-${randomBytes(6).toString("hex")}.jpg`;
    const key = `avatars/${filename}`;
    let photoUrl = publicObjectUrl(key);
    try {
      await storage.upload(key, processed, {
        contentType: "image/jpeg",
        cacheControl: "public, max-age=31536000",
      });
    } catch (err) {
      console.error("[avatar] object storage failed", err?.message || err);
      photoUrl = `data:image/jpeg;base64,${processed.toString("base64")}`;
    }

    const previous = await query(`SELECT avatar_url FROM user_profiles WHERE user_id = $1`, [userId]);
    const previousKey = storageKeyFromUrl(previous.rows[0]?.avatar_url, "avatars");
    if (previousKey) {
      try {
        await storage.delete(previousKey);
      } catch (err) {
        console.warn("[avatar] could not delete previous file", err?.message || err);
      }
    }

    await query(
      `INSERT INTO user_profiles (user_id, avatar_url)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET avatar_url = EXCLUDED.avatar_url`,
      [userId, photoUrl],
    );

    return { status: 200, body: { avatarUrl: photoUrl } };
  } catch (error) {
    console.error("Avatar upload error:", error);
    return { status: 500, body: { error: "Could not upload that photo." } };
  }
}

export async function clearAvatar(userId) {
  const previous = await query(`SELECT avatar_url FROM user_profiles WHERE user_id = $1`, [userId]);
  const previousKey = storageKeyFromUrl(previous.rows[0]?.avatar_url, "avatars");
  if (previousKey) {
    try {
      await storage.delete(previousKey);
    } catch (err) {
      console.warn("[avatar] could not delete file", err?.message || err);
    }
  }
  await query(`UPDATE user_profiles SET avatar_url = NULL WHERE user_id = $1`, [userId]);
  return { status: 200, body: { avatarUrl: null } };
}

/**
 * Delete photo
 */
export async function deletePhoto(photoId, userId) {
  try {
    // Get photo details and verify ownership
    const result = await query(
      `SELECT p.*, l.seller_id
       FROM listing_photos p
       JOIN listings l ON p.listing_id = l.id
       WHERE p.id = $1`,
      [photoId]
    );

    if (!result.rows[0]) {
      return { status: 404, body: { error: 'Photo not found' } };
    }

    const photo = result.rows[0];
    if (photo.seller_id !== userId) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    // Extract filename from URL (format: https://.../uploads/listings/filename.jpg)
    const filename = photo.url.split('/').pop();
    const thumbnailFilename = photo.thumbnail_url.split('/').pop();

    try {
      // Delete from Neon Object Storage
      await storage.delete(`listings/${filename}`);
      await storage.delete(`listings/${thumbnailFilename}`);
    } catch (err) {
      console.warn('Failed to delete file from storage:', err.message);
      // Continue even if file deletion fails
    }

    // Delete from database
    await query('DELETE FROM listing_photos WHERE id = $1', [photoId]);

    // If this was primary, set next photo as primary
    if (photo.is_primary) {
      await query(
        `UPDATE listing_photos 
         SET is_primary = true 
         WHERE listing_id = $1 
         ORDER BY position 
         LIMIT 1`,
        [photo.listing_id]
      );
    }

    return { status: 200, body: { success: true } };

  } catch (error) {
    console.error('Photo delete error:', error);
    return { 
      status: 500, 
      body: { error: 'Failed to delete photo', details: error.message } 
    };
  }
}

/**
 * Set photo as primary
 */
export async function setPrimaryPhoto(photoId, userId) {
  try {
    // Get photo details and verify ownership
    const result = await query(
      `SELECT p.*, l.seller_id
       FROM listing_photos p
       JOIN listings l ON p.listing_id = l.id
       WHERE p.id = $1`,
      [photoId]
    );

    if (!result.rows[0]) {
      return { status: 404, body: { error: 'Photo not found' } };
    }

    const photo = result.rows[0];
    if (photo.seller_id !== userId) {
      return { status: 403, body: { error: 'Not authorized' } };
    }

    // Unset all primary photos for this listing
    await query(
      'UPDATE listing_photos SET is_primary = false WHERE listing_id = $1',
      [photo.listing_id]
    );

    // Set this photo as primary
    await query(
      'UPDATE listing_photos SET is_primary = true WHERE id = $1',
      [photoId]
    );

    return { status: 200, body: { success: true } };

  } catch (error) {
    console.error('Set primary photo error:', error);
    return { 
      status: 500, 
      body: { error: 'Failed to set primary photo', details: error.message } 
    };
  }
}
