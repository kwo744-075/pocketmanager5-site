// KPI Presets management - load/save from Supabase

import { supabase } from '@/lib/supabaseClient';
import { ReviewPreset, UploadMapping } from './types';

export async function loadPresets(scope: 'DM' | 'RD', cadence: string): Promise<ReviewPreset[]> {
  const { data, error } = await supabase
    .from('kpi_review_presets')
    .select('*')
    .eq('scope', scope)
    .eq('cadence', cadence)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load presets:', error);
    return [];
  }

  return data || [];
}

export async function savePreset(preset: Omit<ReviewPreset, 'id' | 'created_at'>): Promise<ReviewPreset | null> {
  const { data, error } = await supabase
    .from('kpi_review_presets')
    .insert([preset])
    .select()
    .single();

  if (error) {
    console.error('Failed to save preset:', error);
    return null;
  }

  return data;
}

export async function loadMappings(): Promise<UploadMapping[]> {
  const { data, error } = await supabase
    .from('kpi_upload_mappings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load mappings:', error);
    return [];
  }

  return data || [];
}

export async function saveMapping(mapping: Omit<UploadMapping, 'id' | 'created_at'>): Promise<UploadMapping | null> {
  const { data, error } = await supabase
    .from('kpi_upload_mappings')
    .insert([mapping])
    .select()
    .single();

  if (error) {
    console.error('Failed to save mapping:', error);
    return null;
  }

  return data;
}