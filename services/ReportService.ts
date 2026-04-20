import { InfractionLog } from '../types';

interface StoredInfractionOutput {
  filename: string;
  path: string;
  folderPath: string;
  generalImagePaths: string[];
  detailImagePaths: string[];
  videoPath?: string;
}

interface StoredBatchOutput {
  filename: string;
  path: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');

const parseInfractionDate = (localTime?: string, fallback?: string): Date => {
  const source = localTime || fallback || '';

  const slashMatch = source.match(
    /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (slashMatch) {
    return new Date(
      Number(slashMatch[3]),
      Number(slashMatch[2]) - 1,
      Number(slashMatch[1]),
      Number(slashMatch[4] || 0),
      Number(slashMatch[5] || 0),
      Number(slashMatch[6] || 0)
    );
  }

  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const getFolderDate = (date: Date): string =>
  `${date.getFullYear()}_${pad(date.getMonth() + 1)}_${pad(date.getDate())}`;

const getTimeParts = (log: InfractionLog): { day: string; time: string } => {
  const date = parseInfractionDate(log.localTime, log.time);
  return {
    day: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
  };
};

const buildInfractionPayload = (log: InfractionLog) => {
  const date = parseInfractionDate(log.localTime, log.time);
  const { day, time } = getTimeParts(log);

  return {
    sourceId: `${log.id}_${log.plate || 'SIN_PLACA'}_${date.getTime()}`,
    plate: log.plate || '',
    day,
    time,
    folderDate: getFolderDate(date),
    infractionLocation: log.infractionLocation || '',
    generalImages: log.extraSnapshots || [],
    detailImages: log.zoomSnapshots || [],
    videoClip: log.videoClip || '',
    metadata: {
      localTime: log.localTime || '',
      videoTimeCode: log.videoTimeCode || '',
      ruleCategory: log.ruleCategory || '',
      description: log.description || '',
      severity: log.severity || '',
    },
  };
};

const postJson = async <TResponse>(url: string, payload: unknown): Promise<TResponse> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`No se pudo completar la operación en el servidor`);
  }

  return (await response.json()) as TResponse;
};

export const ReportService = {
  async saveInfractionBundle(log: InfractionLog): Promise<StoredInfractionOutput> {
    const payload = buildInfractionPayload(log);
    const result = await postJson<{
      saved: boolean;
      tablePath: string;
      folderPath: string;
      generalImagePaths: string[];
      detailImagePaths: string[];
      videoPath?: string;
    }>('/api/reports/infraction', payload);

    return {
      filename: result.tablePath.split(/[\\/]/).pop() || 'Infracciones.xls',
      path: result.tablePath,
      folderPath: result.folderPath,
      generalImagePaths: result.generalImagePaths,
      detailImagePaths: result.detailImagePaths,
      videoPath: result.videoPath,
    };
  },

  async generateAndSaveInfractionPdf(log: InfractionLog): Promise<StoredInfractionOutput> {
    return this.saveInfractionBundle(log);
  },

  async generateAndSaveBatchPdf(infractions: InfractionLog[]): Promise<StoredBatchOutput> {
    if (infractions.length === 0) {
      throw new Error('No hay infracciones para registrar');
    }

    let lastResult: StoredInfractionOutput | null = null;
    for (const infraction of infractions) {
      lastResult = await this.saveInfractionBundle(infraction);
    }

    return {
      filename: lastResult!.filename,
      path: lastResult!.path,
    };
  },

  async exportToCsv(infractions: InfractionLog[], _filename = 'Infracciones.xls'): Promise<void> {
    if (infractions.length === 0) return;
    await this.generateAndSaveBatchPdf(infractions);
  },

  async saveVideoToDisk(_buffer: ArrayBuffer, _filename: string, _dateStr?: string): Promise<string> {
    throw new Error(
      'La evidencia de vídeo se guarda automáticamente junto con la infracción desde el nuevo flujo'
    );
  },

  async downloadInfractionPdf(log: InfractionLog): Promise<void> {
    await this.saveInfractionBundle(log);
  },
};
