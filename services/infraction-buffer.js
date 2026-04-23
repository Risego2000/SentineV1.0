/**
 * Infraction Buffer Service
 * Accumulates detected infractions over a 30-second window
 * before generating boletín reports
 */

const BUFFER_DURATION_MS = 30000; // 30 seconds

class InfractionBuffer {
  constructor() {
    this.buffers = new Map(); // plate -> { infractions: [...], timeout: id }
  }

  /**
   * Add an infraction to the buffer
   * @param {string} plate - Vehicle license plate
   * @param {object} infractionData - Infraction details
   * @param {function} onBufferReady - Callback when buffer expires
   */
  addInfraction(plate, infractionData, onBufferReady) {
    if (!plate) return;

    let buffer = this.buffers.get(plate);

    // Create new buffer if doesn't exist
    if (!buffer) {
      buffer = {
        infractions: [],
        plate,
        createdAt: Date.now(),
      };
      this.buffers.set(plate, buffer);

      console.log(
        `[INFRACTION_BUFFER] Nuevo buffer creado para placa ${plate}`
      );
    }

    // Add infraction to buffer
    buffer.infractions.push({
      ...infractionData,
      bufferedAt: Date.now(),
    });

    console.log(
      `[INFRACTION_BUFFER] Infracción añadida a buffer ${plate} (total: ${buffer.infractions.length})`
    );

    // Clear existing timeout
    if (buffer.timeout) {
      clearTimeout(buffer.timeout);
    }

    // Set new timeout to process buffer
    buffer.timeout = setTimeout(() => {
      this.processBuffer(plate, onBufferReady);
    }, BUFFER_DURATION_MS);
  }

  /**
   * Process accumulated infractions
   */
  processBuffer(plate, onBufferReady) {
    const buffer = this.buffers.get(plate);

    if (!buffer || buffer.infractions.length === 0) {
      console.log(`[INFRACTION_BUFFER] Buffer vacío para ${plate}`);
      this.buffers.delete(plate);
      return;
    }

    console.log(
      `[INFRACTION_BUFFER] Procesando buffer de ${plate} (${buffer.infractions.length} infracciones acumuladas)`
    );

    // Call the callback with accumulated infractions
    if (onBufferReady) {
      onBufferReady(plate, buffer.infractions);
    }

    // Clear the buffer
    this.buffers.delete(plate);
  }

  /**
   * Force process a buffer immediately (for testing)
   */
  forceProcess(plate, onBufferReady) {
    const buffer = this.buffers.get(plate);

    if (buffer && buffer.timeout) {
      clearTimeout(buffer.timeout);
    }

    this.processBuffer(plate, onBufferReady);
  }

  /**
   * Get buffer status for a plate
   */
  getStatus(plate) {
    const buffer = this.buffers.get(plate);

    if (!buffer) {
      return { buffered: false, count: 0 };
    }

    const elapsedMs = Date.now() - buffer.createdAt;
    const remainingMs = BUFFER_DURATION_MS - elapsedMs;

    return {
      buffered: true,
      count: buffer.infractions.length,
      createdAt: buffer.createdAt,
      elapsedMs,
      remainingMs: Math.max(0, remainingMs),
      percentComplete: Math.min(
        100,
        Math.round((elapsedMs / BUFFER_DURATION_MS) * 100)
      ),
    };
  }

  /**
   * Aggregate infractions from buffer
   * Combines multiple infractions into a summary
   */
  static aggregateInfractions(infractions) {
    if (!infractions || infractions.length === 0) {
      return null;
    }

    // Use the most severe infraction as primary
    const sorted = [...infractions].sort((a, b) => {
      const severityOrder = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };
      return (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
    });

    const primary = sorted[0];

    // Combine descriptions if multiple infractions
    let description = primary.description || '';
    if (infractions.length > 1) {
      description += ` (y ${infractions.length - 1} infracción(es) más en los últimos 30 segundos)`;
    }

    return {
      plate: primary.plate,
      infractionType: primary.infractionType,
      severity: primary.severity,
      timestamp: primary.timestamp,
      location: primary.location,
      description,
      makeModel: primary.makeModel,
      color: primary.color,
      infractionsCount: infractions.length,
      timestamps: infractions.map((i) => i.timestamp),
    };
  }
}

// Export singleton instance
export const infractionBuffer = new InfractionBuffer();
