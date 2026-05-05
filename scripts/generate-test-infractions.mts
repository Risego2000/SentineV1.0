/**
 * Generate Test Infractions Data
 * Script to populate Supabase with sample infractions and expedients
 * for testing the InfractionsTable component
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Supabase credentials not found in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Sample infractions data
const sampleInfractions = [
  {
    plate: 'ABC1234',
    make_model: 'Audi A4',
    color: 'Negro',
    description: 'Cruzó línea de semáforo en rojo',
    severity: 'HIGH',
    rule_category: 'SEMAFORO_ROJO',
    legal_base: 'Art. 67 LTSV',
    status: 'DETECTED',
    time: new Date(Date.now() - 3600000).toISOString(),
    local_time: new Date(Date.now() - 3600000).toLocaleString(),
    video_time_code: '14:32:15.123',
    fine_amount: 200,
    points_deducted: 3,
    validation_status: 'PENDING',
  },
  {
    plate: 'XYZ9876',
    make_model: 'BMW M3',
    color: 'Blanco',
    description: 'Exceso de velocidad en zona de 50 km/h',
    severity: 'MEDIUM',
    rule_category: 'SPEED_VIOLATION',
    legal_base: 'Art. 47 LTSV',
    status: 'DETECTED',
    time: new Date(Date.now() - 7200000).toISOString(),
    local_time: new Date(Date.now() - 7200000).toLocaleString(),
    video_time_code: '12:15:30.456',
    fine_amount: 100,
    points_deducted: 2,
    validation_status: 'PENDING',
  },
  {
    plate: 'DEF5678',
    make_model: 'Mercedes C200',
    color: 'Gris',
    description: 'No respetó señal de STOP',
    severity: 'HIGH',
    rule_category: 'STOP_NO_DETENCION',
    legal_base: 'Art. 60 LTSV',
    status: 'DETECTED',
    time: new Date(Date.now() - 10800000).toISOString(),
    local_time: new Date(Date.now() - 10800000).toLocaleString(),
    video_time_code: '10:45:22.789',
    fine_amount: 300,
    points_deducted: 4,
    validation_status: 'VALIDATED',
  },
];

// Sample expedients data (with custody and audit info)
const sampleExpedients = [
  {
    infraction_id: 1,
    custody_last_checked_at: new Date(Date.now() - 1800000).toISOString(),
    custody_last_status: 'SUCCESS',
    custody_last_summary: '3/3 archivos verificados correctamente',
    custody_verification_rows: JSON.stringify([
      {
        fileName: 'video_original.mp4',
        kind: 'ORIGINAL',
        expectedHash: 'a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
        calculatedHash: 'a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
        isValid: true,
        checkedAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        fileName: 'infraction_clip_8s.mp4',
        kind: 'PROCESADA',
        expectedHash: 'b4g5c3d0e9f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6',
        calculatedHash: 'b4g5c3d0e9f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6',
        isValid: true,
        checkedAt: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        fileName: 'report_signed.pdf',
        kind: 'REPORTE',
        expectedHash: 'c5h6d4e1f0g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7',
        calculatedHash: 'c5h6d4e1f0g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7',
        isValid: true,
        checkedAt: new Date(Date.now() - 1800000).toISOString(),
      },
    ]),
    audit_log: JSON.stringify([
      {
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        action: 'EVIDENCE_CREATED',
        actor: 'sistema',
      },
      {
        timestamp: new Date(Date.now() - 3000000).toISOString(),
        action: 'REPORT_GENERATED',
        actor: 'juan_lopez',
      },
      {
        timestamp: new Date(Date.now() - 2400000).toISOString(),
        action: 'REPORT_VALIDATED',
        actor: 'juan_lopez',
      },
      {
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        action: 'REPORT_SIGNED',
        actor: 'admin',
      },
    ]),
    state_history: JSON.stringify([
      {
        from: 'DETECTED',
        to: 'UNDER_REVIEW',
        actor: 'juan_lopez',
        timestamp: Date.now() - 3000000,
      },
      {
        from: 'UNDER_REVIEW',
        to: 'VALIDATED',
        actor: 'juan_lopez',
        timestamp: Date.now() - 2400000,
      },
      {
        from: 'VALIDATED',
        to: 'SIGNED',
        actor: 'admin',
        timestamp: Date.now() - 1800000,
      },
    ]),
    validation: JSON.stringify({
      isValid: true,
      validatedBy: 'juan_lopez',
      validatedAt: Date.now() - 2400000,
      evidenceVerified: true,
      plateVerified: true,
      speedVerified: true,
    }),
    operator: 'juan_lopez@policia.es',
    supervisor: 'admin@policia.es',
    signature_is_signed: true,
    signature_signed_by: 'Digital - 2026-05-04 15:00:00',
    signature_hash: 'a3f4b2c9d8e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5',
    dpia_certified: true,
  },
  {
    infraction_id: 2,
    custody_last_checked_at: new Date(Date.now() - 3600000).toISOString(),
    custody_last_status: 'PENDING',
    custody_last_summary: 'Verificación pendiente',
    operator: 'maria_garcia@policia.es',
    supervisor: null,
    signature_is_signed: false,
    dpia_certified: false,
  },
  {
    infraction_id: 3,
    custody_last_checked_at: new Date(Date.now() - 5400000).toISOString(),
    custody_last_status: 'SUCCESS',
    custody_last_summary: '2/2 archivos verificados correctamente',
    audit_log: JSON.stringify([
      {
        timestamp: new Date(Date.now() - 10800000).toISOString(),
        action: 'EVIDENCE_CREATED',
        actor: 'sistema',
      },
      {
        timestamp: new Date(Date.now() - 9000000).toISOString(),
        action: 'REPORT_GENERATED',
        actor: 'carlos_rodriguez',
      },
      {
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        action: 'REPORT_VALIDATED',
        actor: 'carlos_rodriguez',
      },
    ]),
    state_history: JSON.stringify([
      {
        from: 'DETECTED',
        to: 'UNDER_REVIEW',
        actor: 'carlos_rodriguez',
        timestamp: Date.now() - 9000000,
      },
      {
        from: 'UNDER_REVIEW',
        to: 'VALIDATED',
        actor: 'carlos_rodriguez',
        timestamp: Date.now() - 7200000,
      },
    ]),
    validation: JSON.stringify({
      isValid: true,
      validatedBy: 'carlos_rodriguez',
      validatedAt: Date.now() - 7200000,
      evidenceVerified: true,
      plateVerified: true,
    }),
    operator: 'carlos_rodriguez@policia.es',
    supervisor: null,
    signature_is_signed: false,
    dpia_certified: true,
  },
];

async function generateTestData() {
  console.log('🚀 Generando datos de prueba...\n');

  try {
    // Insert infractions
    console.log('📝 Insertando infracciones...');
    const { data: infractionsData, error: infractionsError } = await supabase
      .from('infractions')
      .insert(sampleInfractions)
      .select();

    if (infractionsError) {
      console.error('❌ Error al insertar infracciones:', infractionsError.message);
      // Try fallback table
      console.log('📝 Intentando tabla fallback "incidents"...');
      const { error: fallbackError } = await supabase
        .from('incidents')
        .insert(sampleInfractions)
        .select();

      if (fallbackError) {
        console.error('❌ Error en tabla fallback:', fallbackError.message);
        process.exit(1);
      }
    }

    console.log(`✅ ${infractionsData?.length || sampleInfractions.length} infracciones insertadas\n`);

    // Insert expedients
    console.log('📋 Insertando expedientes (custodia y auditoría)...');
    const { data: expedientData, error: expedientError } = await supabase
      .from('expedients')
      .insert(sampleExpedients)
      .select();

    if (expedientError) {
      console.log('⚠️ Advertencia: Los datos de custodia no se insertaron (tabla opcional)');
      console.log(`   Error: ${expedientError.message}\n`);
    } else {
      console.log(`✅ ${expedientData?.length || sampleExpedients.length} expedientes insertados\n`);
    }

    console.log('✨ Datos de prueba generados exitosamente!');
    console.log('\n📊 Próximos pasos:');
    console.log('1. Recarga la página de Expedientes (Ctrl+E)');
    console.log('2. Deberías ver la tabla con 3 infracciones de prueba');
    console.log('3. Expande cada fila con el botón "⋯" para ver todos los datos\n');

  } catch (error) {
    console.error('❌ Error inesperado:', error);
    process.exit(1);
  }
}

generateTestData();
