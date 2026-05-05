/**
 * Supabase Storage Service
 * Sube imágenes y videos a Supabase Storage, retorna URLs públicas
 * Escalable y seguro para acceso futuro
 */

import { supabase } from './supabase';
import { logger } from './logger';

export interface StorageUploadResult {
  success: boolean;
  url?: string; // URL pública
  path?: string; // Ruta interna
  error?: string;
  size?: number;
}

export class SupabaseStorageService {
  private static readonly BUCKET = 'evidence'; // Nombre del bucket
  private static readonly MAX_SIZE = 50 * 1024 * 1024; // 50MB máximo

  /**
   * Convierte base64 a Blob para subir
   */
  static base64ToBlob(base64: string, mimeType = 'image/jpeg'): Blob {
    const byteCharacters = atob(base64.replace(/^data:image\/\w+;base64,/, ''));
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  /**
   * Sube una imagen (base64 o URL) a Storage
   * Retorna URL pública para guardar en database
   */
  static async uploadImage(
    base64OrUrl: string,
    expedientId: string,
    kind: 'ORIGINAL' | 'GENERAL' | 'DETALLE' | 'ZOOM',
    captureType: string
  ): Promise<StorageUploadResult> {
    try {
      // Si ya es URL, devolverla directamente
      if (base64OrUrl.startsWith('http://') || base64OrUrl.startsWith('https://')) {
        return { success: true, url: base64OrUrl };
      }

      // Convertir base64 a Blob
      const blob = this.base64ToBlob(base64OrUrl);

      if (blob.size > this.MAX_SIZE) {
        return {
          success: false,
          error: `Imagen muy grande: ${blob.size} bytes (máximo ${this.MAX_SIZE})`
        };
      }

      // Ruta: expedient_id/kind/timestamp-capture_type.jpg
      const timestamp = Date.now();
      const fileName = `${timestamp}-${captureType}.jpg`;
      const path = `${expedientId}/${kind}/${fileName}`;

      // Subir a Storage
      const { data, error } = await supabase.storage
        .from(this.BUCKET)
        .upload(path, blob, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (error) {
        logger.error('SUPABASE_STORAGE', `Upload failed: ${error.message}`);
        return { success: false, error: error.message };
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from(this.BUCKET)
        .getPublicUrl(path);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        return { success: false, error: 'No se pudo obtener URL pública' };
      }

      logger.debug('SUPABASE_STORAGE', `Uploaded ${kind} (${blob.size} bytes) → ${publicUrl}`);

      return {
        success: true,
        url: publicUrl,
        path,
        size: blob.size
      };
    } catch (error) {
      logger.error('SUPABASE_STORAGE', 'Upload error', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Sube un video (base64 o URL) a Storage
   */
  static async uploadVideo(
    base64OrUrl: string,
    expedientId: string,
    captureType = 'FULL'
  ): Promise<StorageUploadResult> {
    try {
      // Si ya es URL, devolverla directamente
      if (base64OrUrl.startsWith('http://') || base64OrUrl.startsWith('https://')) {
        return { success: true, url: base64OrUrl };
      }

      // Convertir base64 a Blob
      const byteCharacters = atob(base64OrUrl.replace(/^data:video\/\w+;base64,/, ''));
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'video/mp4' });

      if (blob.size > this.MAX_SIZE) {
        return {
          success: false,
          error: `Video muy grande: ${blob.size} bytes (máximo ${this.MAX_SIZE})`
        };
      }

      // Ruta: expedient_id/VIDEO/timestamp-capture_type.mp4
      const timestamp = Date.now();
      const fileName = `${timestamp}-${captureType}.mp4`;
      const path = `${expedientId}/VIDEO/${fileName}`;

      // Subir a Storage
      const { data, error } = await supabase.storage
        .from(this.BUCKET)
        .upload(path, blob, {
          contentType: 'video/mp4',
          upsert: false,
        });

      if (error) {
        logger.error('SUPABASE_STORAGE', `Video upload failed: ${error.message}`);
        return { success: false, error: error.message };
      }

      // Obtener URL pública
      const { data: publicUrlData } = supabase.storage
        .from(this.BUCKET)
        .getPublicUrl(path);

      const publicUrl = publicUrlData?.publicUrl;

      if (!publicUrl) {
        return { success: false, error: 'No se pudo obtener URL pública del video' };
      }

      logger.debug('SUPABASE_STORAGE', `Video uploaded (${blob.size} bytes) → ${publicUrl}`);

      return {
        success: true,
        url: publicUrl,
        path,
        size: blob.size
      };
    } catch (error) {
      logger.error('SUPABASE_STORAGE', 'Video upload error', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * Borra una imagen de Storage
   */
  static async deleteImage(storagePath: string): Promise<boolean> {
    try {
      if (!storagePath) return false;

      const { error } = await supabase.storage
        .from(this.BUCKET)
        .remove([storagePath]);

      if (error) {
        logger.warn('SUPABASE_STORAGE', `Delete failed: ${error.message}`);
        return false;
      }

      logger.debug('SUPABASE_STORAGE', `Deleted: ${storagePath}`);
      return true;
    } catch (error) {
      logger.error('SUPABASE_STORAGE', 'Delete error', error);
      return false;
    }
  }
}
