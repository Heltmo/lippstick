function req(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

export const CONFIG = {
  SUPABASE_URL: req("VITE_SUPABASE_URL"),
  SUPABASE_ANON_KEY: req("VITE_SUPABASE_ANON_KEY"),
  STRIPE_PUBLISHABLE_KEY: req("VITE_STRIPE_PUBLISHABLE_KEY"),
};
