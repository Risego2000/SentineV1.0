const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabaseUrl = 'https://iyikrnmyxytlnmuvscwj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5aWtybm15eHl0bG5tdXZzY3dqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxOTE2NzQsImV4cCI6MjA5MTc2NzY3NH0.vwnI52KvwYdoinNmGpdceFKwZG9mWHS0XUjoEpPcZY8';

const supabase = createClient(supabaseUrl, supabaseKey);

const expedient = {
  id: crypto.randomUUID(),
  infraction_id: 'TEST-' + Date.now(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  state: 'DETECTED',
  violation_type: 'STOP',
  location: 'Calle Principal 123, Madrid',
  timestamp: new Date().toISOString(),
  license_plate: 'MA-1234-AB',
  vehicle_description: 'Seat Ibiza rojo',
  evidence_id: 'EV-' + crypto.randomUUID().slice(0, 8),
  photos_count: 3,
  operator: 'Operador Test',
  signature_is_signed: false,
  signature_signed_by: null,
  signature_signed_at: null,
  signature_hash: null,
  signature_cert_fingerprint: null,
  state_history: JSON.stringify([
    {
      state: 'DETECTED',
      timestamp: Date.now(),
      changedBy: 'System',
      reason: 'Creación automática'
    }
  ]),
  audit_log: JSON.stringify([
    {
      action: 'CREATE',
      timestamp: Date.now(),
      actor: 'System',
      details: 'Expediente creado de prueba'
    }
  ])
};

(async () => {
  const { data, error } = await supabase
    .from('expedients')
    .insert([expedient]);
  
  if (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } else {
    console.log('✓ Expediente creado exitosamente');
    console.log('📋 ID:', expedient.id);
    console.log('🚗 Placa:', expedient.license_plate);
    console.log('📍 Ubicación:', expedient.location);
    console.log('⚠️  Estado:', expedient.state);
  }
})();
