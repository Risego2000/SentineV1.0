#!/usr/bin/env node

/**
 * Test script to verify expedient creation and database integration
 * Tests that all new fields are properly stored and retrieved
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1cGFiYXNlIiwicm9sZSI6ImFub24iLCJpYXQiOjE0MTczOTIyNDYsImV4cCI6MTc3MzU5MjI0Nn0.CRXP3sSgLkV5z5100FgyrtQWZc1AI6_4-zCj-7hyXyQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testExpedientIntegration() {
  console.log('🧪 INICIANDO TEST DE INTEGRACIÓN DE EXPEDIENTES');
  console.log('===============================================\n');

  try {
    // 1. Test connection
    console.log('✓ Conectando a Supabase...');
    const { data: tables, error: tableError } = await supabase
      .from('expedients')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('✗ Error de conexión:', tableError);
      return;
    }
    console.log('✓ Conexión exitosa\n');

    // 2. Create test expedient with all fields
    console.log('📝 Creando expediente de prueba con todos los campos...');
    const now = Date.now();
    const testExpedientId = `EXP-${new Date(now).toISOString().slice(0, 19).replace(/[-:]/g, '')}-TEST`;

    const testExpedient = {
      // Identificación
      id: testExpedientId,
      infraction_id: 'INF-' + crypto.randomBytes(8).toString('hex'),
      created_at: new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
      state: 'DETECTED',

      // Información del caso
      violation_type: 'SPEED_VIOLATION',
      location: 'Calle Mayor, 123',
      timestamp: new Date(now - 60000).toISOString(), // 1 minuto antes
      license_plate: 'ABC-1234', // Formato español
      vehicle_description: 'Coche blanco, Modelo mediano',

      // Datos del lugar
      via: 'Calle Mayor',
      numero_punto_kilometrico: 'KM 5.2',
      municipio: 'Madrid',
      provincia: 'Madrid',
      latitud: 40.4168,
      longitud: -3.7038,
      gravedad: 'Grave',

      // Datos del vehículo
      marca: 'Seat',
      modelo: 'León',
      color: 'Blanco',
      numero_chasis: 'VSSZZZ3PZ8E123456',
      estado_itv: 'Vigente',
      seguro_obligatorio: true,

      // Datos del titular
      titular_nombre: 'Juan García López',
      titular_dni: '12345678A',
      titular_domicilio: 'Calle Principal, 42',
      titular_localidad: 'Madrid',
      titular_provincia: 'Madrid',
      titular_telefono: '+34 91 123 45 67',
      titular_email: 'juan.garcia@example.com',

      // Datos del conductor
      conductor_nombre: 'María González Pérez',
      conductor_dni: '87654321B',
      conductor_permiso: 'B98765432',
      conductor_clase: 'B',
      conductor_domicilio: 'Avenida España, 99',
      conductor_localidad: 'Madrid',
      conductor_provincia: 'Madrid',
      conductor_telefono: '+34 91 987 65 43',
      conductor_email: 'maria.gonzalez@example.com',

      // Descripción de hechos
      descripcion_detallada_hechos: 'Vehículo circulando a 95 km/h en zona limitada a 50 km/h.',
      circunstancias_agravantes: 'Zona escolar, hora pico',

      // Evidencia
      evidence_id: 'EV-' + crypto.randomBytes(6).toString('hex'),
      photos_count: 3,
      video_clip_hash: crypto.createHash('sha256').update(Buffer.from(Date.now().toString())).digest('hex'),

      // Metadatos
      operator: 'Operador Test',
      supervisor: null,
      signature_is_signed: false,
      signature_signed_by: null,
      signature_hash: null,
      state_history: JSON.stringify([
        {
          from: 'DETECTED',
          to: 'DETECTED',
          actor: 'SYSTEM',
          timestamp: now,
          reason: 'Automatic detection'
        }
      ]),
      audit_log: JSON.stringify([
        {
          timestamp: now,
          action: 'CREATED',
          actor: 'TEST_SCRIPT',
          details: { reason: 'Integration test' }
        }
      ]),
      dpia_certified: false,
      data_retention_days: 365,
    };

    // 3. Insert into database
    console.log('📤 Insertando en base de datos...');
    const { data: insertedData, error: insertError } = await supabase
      .from('expedients')
      .insert([testExpedient])
      .select();

    if (insertError) {
      console.error('✗ Error al insertar:', insertError);
      return;
    }
    console.log('✓ Expediente insertado exitosamente\n');

    // 4. Retrieve and verify all fields
    console.log('📥 Recuperando expediente de la base de datos...');
    const { data: retrievedData, error: retrieveError } = await supabase
      .from('expedients')
      .select('*')
      .eq('id', testExpedientId)
      .single();

    if (retrieveError) {
      console.error('✗ Error al recuperar:', retrieveError);
      return;
    }
    console.log('✓ Expediente recuperado exitosamente\n');

    // 5. Verify all fields
    console.log('✅ VERIFICACIÓN DE CAMPOS:\n');

    const fields = {
      'Identificación': ['id', 'infraction_id', 'created_at', 'updated_at', 'state'],
      'Información del caso': ['violation_type', 'location', 'timestamp', 'license_plate', 'vehicle_description'],
      'Datos del lugar': ['via', 'numero_punto_kilometrico', 'municipio', 'provincia', 'latitud', 'longitud', 'gravedad'],
      'Datos del vehículo': ['marca', 'modelo', 'color', 'numero_chasis', 'estado_itv', 'seguro_obligatorio'],
      'Datos del titular': ['titular_nombre', 'titular_dni', 'titular_domicilio', 'titular_localidad', 'titular_provincia', 'titular_telefono', 'titular_email'],
      'Datos del conductor': ['conductor_nombre', 'conductor_dni', 'conductor_permiso', 'conductor_clase', 'conductor_domicilio', 'conductor_localidad', 'conductor_provincia', 'conductor_telefono', 'conductor_email'],
      'Hechos': ['descripcion_detallada_hechos', 'circunstancias_agravantes'],
      'Evidencia': ['evidence_id', 'photos_count', 'video_clip_hash'],
      'Metadatos': ['operator', 'supervisor', 'signature_is_signed', 'state_history', 'audit_log', 'dpia_certified', 'data_retention_days'],
    };

    let allFieldsValid = true;
    for (const [section, fieldList] of Object.entries(fields)) {
      console.log(`\n${section}:`);
      for (const field of fieldList) {
        const value = retrievedData[field];
        const isPresent = value !== null && value !== undefined;
        const status = isPresent ? '✓' : '✗';
        console.log(`  ${status} ${field}: ${isPresent ? JSON.stringify(value).substring(0, 50) : 'NO ENCONTRADO'}`);
        if (!isPresent) allFieldsValid = false;
      }
    }

    console.log('\n' + (allFieldsValid ? '✅ TODOS LOS CAMPOS PRESENTES' : '⚠️  ALGUNOS CAMPOS FALTAN'));

    // 6. Test update with new state
    console.log('\n\n🔄 PROBANDO ACTUALIZACIÓN A ESTADO UNDER_REVIEW...');
    const { data: updateData, error: updateError } = await supabase
      .from('expedients')
      .update({
        state: 'UNDER_REVIEW',
        updated_at: new Date().toISOString(),
        operator: 'Operador Revisión',
        audit_log: JSON.stringify([
          ...JSON.parse(testExpedient.audit_log),
          {
            timestamp: Date.now(),
            action: 'REVIEWED',
            actor: 'TEST_SCRIPT',
            details: { reviewer: 'Operador Revisión' }
          }
        ])
      })
      .eq('id', testExpedientId)
      .select();

    if (updateError) {
      console.error('✗ Error al actualizar:', updateError);
      return;
    }
    console.log('✓ Expediente actualizado exitosamente\n');

    // 7. Final verification
    console.log('📊 RESUMEN FINAL:');
    console.log(`  ID: ${testExpedientId}`);
    console.log(`  Estado: ${updateData[0].state}`);
    console.log(`  Placa: ${updateData[0].license_plate}`);
    console.log(`  Vehículo: ${updateData[0].marca} ${updateData[0].modelo}`);
    console.log(`  Titular: ${updateData[0].titular_nombre}`);
    console.log(`  Operador: ${updateData[0].operator}`);

    console.log('\n\n✅ TEST DE INTEGRACIÓN COMPLETADO EXITOSAMENTE');
    console.log('===============================================\n');

    // Cleanup
    console.log('🧹 Limpiando datos de prueba...');
    await supabase
      .from('expedients')
      .delete()
      .eq('id', testExpedientId);
    console.log('✓ Datos de prueba eliminados\n');

  } catch (error) {
    console.error('❌ Error no capturado:', error);
  }
}

// Run test
testExpedientIntegration();
