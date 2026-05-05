/**
 * Supabase Evidence Saver
 * Guarda imágenes y videos en Supabase cuando se detecta una infracción
 */

import { supabase } from '../services/supabase';
import { logger } from '../services/logger';

export interface EvidenceToSave {
  expedientId: string;
  infractionId?: string;
  image?: string; // base64
  extraSnapshots?: string[]; // [Initial, Mid, Final]
  zoomSnapshots?: string[]; // [Initial, Mid, Final]
  videoClip?: string; // base64
}

/**
 * Guarda evidencia (imágenes y video) en Supabase
 */
export class SupabaseEvidenceSaver {
  static async saveEvidenceImages(options: EvidenceToSave): Promise<boolean> {
    try {
      const { expedientId, infractionId, image, extraSnapshots, zoomSnapshots, videoClip } =
        options;

      // Guardar imagen principal
      if (image) {
        await this.saveImageToDatabase(
          expedientId,
          infractionId,
          image,
          'ORIGINAL',
          'Imagen principal de la infracción'
        );
      }

      // Guardar snapshots generales (contexto)
      if (extraSnapshots && extraSnapshots.length > 0) {
        for (let i = 0; i < extraSnapshots.length; i++) {
          const captureType =
            i === 0 ? 'INITIAL' : i === Math.floor(extraSnapshots.length / 2) ? 'MID' : 'FINAL';
          await this.saveImageToDatabase(
            expedientId,
            infractionId,
            extraSnapshots[i],
            'GENERAL',
            `Snapshot de contexto ${captureType}`,
            captureType
          );
        }
      }

      // Guardar snapshots zoom
      if (zoomSnapshots && zoomSnapshots.length > 0) {
        for (let i = 0; i < zoomSnapshots.length; i++) {
          const captureType =
            i === 0 ? 'INITIAL' : i === Math.floor(zoomSnapshots.length / 2) ? 'MID' : 'FINAL';
          await this.saveImageToDatabase(
            expedientId,
            infractionId,
            zoomSnapshots[i],
            'DETALLE',
            `Snapshot zoom ${captureType}`,
            captureType
          );
        }
      }

      // Guardar video clip
      if (videoClip) {
        await this.saveVideoToDatabase(expedientId, infractionId, videoClip);
      }

      logger.info(
        'SUPABASE_EVIDENCE_SAVER',
        `Evidence saved for expedient ${expedientId}`,
        {
          hasImage: !!image,
          extraSnapshotsCount: extraSnapshots?.length || 0,
          zoomSnapshotsCount: zoomSnapshots?.length || 0,
          hasVideo: !!videoClip,
        }
      );

      return true;
    } catch (error) {
      logger.error('SUPABASE_EVIDENCE_SAVER', 'Failed to save evidence', error);
      return false;
    }
  }

  /**
   * Guarda una imagen en la tabla evidence
   */
  private static async saveImageToDatabase(
    expedientId: string,
    infractionId: string | undefined,
    imageBase64: string,
    kind: 'ORIGINAL' | 'GENERAL' | 'DETALLE' | 'ZOOM',
    description: string,
    captureType?: 'INITIAL' | 'MID' | 'FINAL' | string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('evidence').insert([
        {
          expedient_id: expedientId,
          infraction_id: infractionId || null,
          kind: kind,
          image_base64: imageBase64,
          description: description,
          capture_type: captureType || 'UNKNOWN',
          captured_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        logger.warn('SUPABASE_EVIDENCE_SAVER', `Failed to save image: ${error.message}`);
        return false;
      }

      // También guardar en expedient_images para fácil acceso
      await this.saveToExpedientImages(expedientId, imageBase64, kind, description);

      return true;
    } catch (error) {
      logger.error('SUPABASE_EVIDENCE_SAVER', 'Error saving image', error);
      return false;
    }
  }

  /**
   * Guarda una imagen en expedient_images para rápido acceso
   */
  private static async saveToExpedientImages(
    expedientId: string,
    imageBase64: string,
    kind: string,
    description: string
  ): Promise<void> {
    try {
      await supabase.from('expedient_images').insert([
        {
          expedient_id: expedientId,
          kind: kind,
          image_base64: imageBase64,
          description: description,
        },
      ]);
    } catch (error) {
      logger.warn('SUPABASE_EVIDENCE_SAVER', 'Failed to save to expedient_images', error);
    }
  }

  /**
   * Guarda un video en la tabla evidence
   */
  private static async saveVideoToDatabase(
    expedientId: string,
    infractionId: string | undefined,
    videoBase64: string
  ): Promise<boolean> {
    try {
      // Calcular tamaño aproximado del video
      const videoSizeBytes = Math.ceil((videoBase64.length * 3) / 4);

      const { data, error } = await supabase.from('evidence').insert([
        {
          expedient_id: expedientId,
          infraction_id: infractionId || null,
          kind: 'VIDEO',
          image_base64: videoBase64, // Guardar video en el campo de imagen (es base64)
          description: 'Video clip de 8 segundos',
          capture_type: 'FULL',
          file_size_bytes: videoSizeBytes,
          content_type: 'video/mp4',
          captured_at: new Date().toISOString(),
        },
      ]);

      if (error) {
        logger.warn('SUPABASE_EVIDENCE_SAVER', `Failed to save video: ${error.message}`);
        return false;
      }

      logger.info(
        'SUPABASE_EVIDENCE_SAVER',
        `Video saved for expedient ${expedientId}`,
        {
          sizeBytes: videoSizeBytes,
        }
      );

      return true;
    } catch (error) {
      logger.error('SUPABASE_EVIDENCE_SAVER', 'Error saving video', error);
      return false;
    }
  }
}
