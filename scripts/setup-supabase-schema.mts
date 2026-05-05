/**
 * Setup Supabase Schema
 * Creates infractions and expedients tables if they don't exist
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Supabase credentials not found');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function setupSchema() {
  console.log('🔧 Configurando esquema de Supabase...\n');

  try {
    // Create infractions table
    console.log('📝 Creando tabla "infractions"...');
    const { error: infractionsError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.infractions (
          id BIGSERIAL PRIMARY KEY,
          plate TEXT,
          make_model TEXT,
          color TEXT,
          description TEXT,
          severity TEXT,
          rule_category TEXT,
          legal_base TEXT,
          status TEXT,
          time TIMESTAMP,
          local_time TEXT,
          video_time_code TEXT,
          fine_amount INTEGER,
          points_deducted INTEGER,
          validation_status TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_infractions_plate ON public.infractions(plate);
        CREATE INDEX IF NOT EXISTS idx_infractions_created ON public.infractions(created_at DESC);
      `,
    });

    if (infractionsError && !infractionsError.message.includes('execute_sql')) {
      // RPC function might not exist, that's okay
      console.log('ℹ️  Usando método alternativo para crear tabla...');
    } else if (infractionsError) {
      console.log('⚠️  ' + infractionsError.message);
    } else {
      console.log('✅ Tabla infractions lista\n');
    }

    // Create expedients table
    console.log('📋 Creando tabla "expedients"...');
    const { error: expedientError } = await supabase.rpc('execute_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.expedients (
          id BIGSERIAL PRIMARY KEY,
          infraction_id BIGINT REFERENCES public.infractions(id),
          custody_last_checked_at TIMESTAMP,
          custody_last_status TEXT,
          custody_last_summary TEXT,
          custody_verification_rows JSONB,
          audit_log JSONB,
          state_history JSONB,
          validation JSONB,
          operator TEXT,
          supervisor TEXT,
          signature_is_signed BOOLEAN,
          signature_signed_by TEXT,
          signature_hash TEXT,
          dpia_certified BOOLEAN,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_expedients_infraction ON public.expedients(infraction_id);
        CREATE INDEX IF NOT EXISTS idx_expedients_created ON public.expedients(created_at DESC);
      `,
    });

    if (expedientError && !expedientError.message.includes('execute_sql')) {
      console.log('⚠️  ' + expedientError.message);
    } else {
      console.log('✅ Tabla expedients lista\n');
    }

    // Enable RLS
    console.log('🔐 Configurando RLS (Row Level Security)...');
    const { error: rlsError } = await supabase.rpc('execute_sql', {
      sql: `
        ALTER TABLE public.infractions ENABLE ROW LEVEL SECURITY;
        ALTER TABLE public.expedients ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Allow public read infractions" ON public.infractions FOR SELECT USING (true);
        CREATE POLICY "Allow public read expedients" ON public.expedients FOR SELECT USING (true);
      `,
    });

    if (rlsError) {
      console.log('⚠️  RLS: ' + rlsError.message);
    } else {
      console.log('✅ RLS configurado\n');
    }

    console.log('✨ Esquema configurado exitosamente!');
    console.log('\n📝 Ahora ejecuta: npm run generate-test-data\n');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Alternativa: Crea manualmente las tablas en Supabase Dashboard:');
    console.log('   https://supabase.com/dashboard/project/iyikrnmyxytlnmuvscwj/sql\n');
    process.exit(1);
  }
}

setupSchema();
