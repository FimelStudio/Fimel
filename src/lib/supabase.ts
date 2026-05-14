import { createClient } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      work_download_targets: {
        Row: {
          slug: string;
          label: string;
          is_public: boolean;
          created_at: string;
        };
        Insert: {
          slug: string;
          label: string;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          slug?: string;
          label?: string;
          is_public?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      work_downloads: {
        Row: {
          slug: string;
          download_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          slug: string;
          download_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          slug?: string;
          download_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'work_downloads_slug_fkey';
            columns: ['slug'];
            isOneToOne: true;
            referencedRelation: 'work_download_targets';
            referencedColumns: ['slug'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      increment_work_download: {
        Args: { p_slug: string };
        Returns: number | string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
  || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;
