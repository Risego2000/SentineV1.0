/**
 * Evidence Storage Service
 * Handles file uploads to Supabase Storage and database record management
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const BUCKET_NAME = 'evidence';
const MAX_PHOTO_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

export interface EvidenceFile {
  id: string;
  infraction_id: string;
  file_type: 'photo' | 'video';
  file_path: string;
  file_size: number;
  file_name: string;
  created_at: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
  };
  is_forensic: boolean;
}

/**
 * Compress image file
 */
export async function compressImage(
  file: Blob,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, 'image/jpeg', quality);
        } else {
          resolve(file);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload evidence file to Supabase Storage
 */
export async function uploadEvidenceFile(
  infractionId: string,
  file: Blob,
  fileType: 'photo' | 'video',
  fileName: string,
  compressImages: boolean = true
): Promise<EvidenceFile | null> {
  try {
    // Validate file size
    const maxSize = fileType === 'photo' ? MAX_PHOTO_SIZE : MAX_VIDEO_SIZE;
    if (file.size > maxSize) {
      throw new Error(`File size exceeds ${maxSize / (1024 * 1024)}MB limit`);
    }

    // Compress image if needed
    let finalFile = file;
    if (fileType === 'photo' && compressImages) {
      finalFile = await compressImage(file, 0.8);
    }

    // Generate file path
    const timestamp = Date.now();
    const fileExt = fileName.split('.').pop();
    const safeName = `${fileType}-${timestamp}.${fileExt}`;
    const filePath = `${infractionId}/${fileType}s/${safeName}`;

    // Upload to Storage
    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, finalFile, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[EVIDENCE_STORAGE] Upload error:', uploadError);
      throw uploadError;
    }

    // Create database record
    const { data: dbData, error: dbError } = await supabase
      .from('evidence_files')
      .insert([
        {
          infraction_id: infractionId,
          file_type: fileType,
          file_path: filePath,
          file_size: finalFile.size,
          file_name: fileName,
          metadata: {
            uploadedAt: new Date().toISOString(),
          },
          is_forensic: false,
        },
      ])
      .select()
      .single();

    if (dbError) {
      console.error('[EVIDENCE_STORAGE] Database insert error:', dbError);
      // Delete uploaded file if DB insert fails
      await supabase.storage.from(BUCKET_NAME).remove([filePath]);
      throw dbError;
    }

    return dbData as EvidenceFile;
  } catch (error) {
    console.error('[EVIDENCE_STORAGE] Upload failed:', error);
    throw error;
  }
}

/**
 * Get all evidence files for an infraction
 */
export async function getEvidenceFiles(infractionId: string): Promise<EvidenceFile[]> {
  try {
    const { data, error } = await supabase
      .from('evidence_files')
      .select('*')
      .eq('infraction_id', infractionId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []) as EvidenceFile[];
  } catch (error) {
    console.error('[EVIDENCE_STORAGE] Fetch failed:', error);
    return [];
  }
}

/**
 * Delete evidence file
 */
export async function deleteEvidenceFile(fileId: string): Promise<boolean> {
  try {
    // Get file info first
    const { data, error: selectError } = await supabase
      .from('evidence_files')
      .select('file_path')
      .eq('id', fileId)
      .single();

    if (selectError || !data) throw selectError || new Error('File not found');

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([data.file_path]);

    if (storageError) throw storageError;

    // Delete from database
    const { error: dbError } = await supabase
      .from('evidence_files')
      .delete()
      .eq('id', fileId);

    if (dbError) throw dbError;
    return true;
  } catch (error) {
    console.error('[EVIDENCE_STORAGE] Delete failed:', error);
    return false;
  }
}

/**
 * Generate signed URL for accessing file
 */
export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, expiresIn);

    if (error) throw error;
    return data?.signedUrl || '';
  } catch (error) {
    console.error('[EVIDENCE_STORAGE] Signed URL generation failed:', error);
    return '';
  }
}

/**
 * Get public URL for file (if bucket is public)
 */
export function getPublicUrl(filePath: string): string {
  try {
    const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);
    return data?.publicUrl || '';
  } catch (error) {
    console.error('[EVIDENCE_STORAGE] Public URL generation failed:', error);
    return '';
  }
}

/**
 * Sync evidence files (for offline scenarios)
 */
export async function syncEvidenceFiles(infractionId: string): Promise<void> {
  try {
    // This can be used to sync files from offline storage
    // For now, just fetching from cloud
    await getEvidenceFiles(infractionId);
  } catch (error) {
    console.error('[EVIDENCE_STORAGE] Sync failed:', error);
  }
}
