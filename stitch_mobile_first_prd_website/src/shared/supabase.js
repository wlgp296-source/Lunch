import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;

let anonymousUserPromise = null;
const LOCAL_IDENTITY_KEY = 'lunch-roulette-anonymous-identity';

export async function ensureSupabaseUser() {
  if (!supabase) return null;
  if (anonymousUserPromise) return anonymousUserPromise;

  anonymousUserPromise = (async () => {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (sessionData.session?.user) return sessionData.session.user;

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    return data.user;
  })().catch(error => {
    anonymousUserPromise = null;
    throw error;
  });

  return anonymousUserPromise;
}

// Nicknames are display names and can change from room to room. Keep a stable
// browser identity for team membership and meal history instead.
export async function ensureStableIdentityId() {
  try {
    const user = await ensureSupabaseUser();
    if (user?.id) return user.id;
  } catch {
    // Local preview or a project with anonymous auth disabled uses the local
    // fallback below. The same browser still keeps the same identity.
  }

  try {
    let identity = localStorage.getItem(LOCAL_IDENTITY_KEY);
    if (!identity) {
      identity = globalThis.crypto?.randomUUID?.()
        || `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(LOCAL_IDENTITY_KEY, identity);
    }
    return identity;
  } catch {
    return `local-${Date.now()}`;
  }
}

export async function saveMealHistory({ meal, source = 'solo', status = 'planned' }) {
  const user = await ensureSupabaseUser();
  if (!supabase || !user || !meal) return false;

  const { error } = await supabase.from('meal_history').upsert({
    user_id: user.id,
    meal_id: meal.id,
    meal_name: meal.name,
    category: meal.category || null,
    source,
    status,
    eaten_date: new Date().toISOString().slice(0, 10),
  }, { onConflict: 'user_id,meal_id,eaten_date' });

  if (error) throw error;
  return true;
}

export async function loadRecentMealNames(limit = 30) {
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from('meal_history')
    .select('meal_name')
    .order('eaten_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return [...new Set((data || []).map(item => item.meal_name).filter(Boolean))];
}

export async function loadRecentMealHistory(limit = 30) {
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from('meal_history')
    .select('meal_id, meal_name, category, source, status, eaten_date')
    .order('eaten_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).filter(item => item.meal_name).map(item => ({
    mealId: item.meal_id,
    mealName: item.meal_name,
    category: item.category,
    source: item.source,
    status: item.status,
    eatenDate: item.eaten_date,
  }));
}
