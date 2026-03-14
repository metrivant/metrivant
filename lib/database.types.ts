// Hand-crafted Supabase database types derived from the pipeline codebase.
// Re-generate via `supabase gen types typescript` once SUPABASE_ACCESS_TOKEN is available.
//
// Schema constraints (enforced in DB, reflected here for reference):
//   signals.dedup_hash        — UNIQUE partial index WHERE dedup_hash IS NOT NULL (migration 011)
//   signals.signal_hash       — UNIQUE partial index WHERE signal_hash IS NOT NULL (migration 008)
//   section_baselines         — UNIQUE(monitored_page_id, section_type)            (migration 011)
//   strategic_movements       — UNIQUE(competitor_id, movement_type)               (migration 002)
//   section_diffs             — UNIQUE(monitored_page_id, section_type, previous_section_id) (migration 004)
//   activity_events           — table added in migration 008

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      competitors: {
        Row: {
          id: string;
          name: string;
          website_url: string | null;
          active: boolean;
          pressure_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          website_url?: string | null;
          active?: boolean;
          pressure_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          website_url?: string | null;
          active?: boolean;
          pressure_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_events: {
        Row: {
          id: string;
          competitor_id: string;
          event_type: string;
          source_headline: string | null;
          url: string | null;
          detected_at: string;
          page_class: string;
          raw_data: Json | null;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          event_type: string;
          source_headline?: string | null;
          url?: string | null;
          detected_at?: string;
          page_class?: string;
          raw_data?: Json | null;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          event_type?: string;
          source_headline?: string | null;
          url?: string | null;
          detected_at?: string;
          page_class?: string;
          raw_data?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_events_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
      monitored_pages: {
        Row: {
          id: string;
          competitor_id: string;
          url: string;
          page_type: string;
          page_class: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          url: string;
          page_type: string;
          page_class?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          url?: string;
          page_type?: string;
          page_class?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "monitored_pages_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
      snapshots: {
        Row: {
          id: string;
          monitored_page_id: string;
          fetched_at: string;
          raw_html: string;
          extracted_text: string | null;
          content_hash: string;
          status: string;
          sections_extracted: boolean;
          sections_extracted_at: string | null;
          is_duplicate: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          fetched_at: string;
          raw_html: string;
          extracted_text?: string | null;
          content_hash: string;
          status?: string;
          sections_extracted?: boolean;
          sections_extracted_at?: string | null;
          is_duplicate?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          fetched_at?: string;
          raw_html?: string;
          extracted_text?: string | null;
          content_hash?: string;
          status?: string;
          sections_extracted?: boolean;
          sections_extracted_at?: string | null;
          is_duplicate?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "snapshots_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      extraction_rules: {
        Row: {
          id: string;
          monitored_page_id: string;
          section_type: string;
          selector: string;
          extract_method: string;
          active: boolean;
          min_length: number | null;
          max_length: number | null;
          required_pattern: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          section_type: string;
          selector: string;
          extract_method?: string;
          active?: boolean;
          min_length?: number | null;
          max_length?: number | null;
          required_pattern?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          section_type?: string;
          selector?: string;
          extract_method?: string;
          active?: boolean;
          min_length?: number | null;
          max_length?: number | null;
          required_pattern?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "extraction_rules_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      page_sections: {
        Row: {
          id: string;
          snapshot_id: string;
          monitored_page_id: string;
          section_type: string;
          section_text: string;
          section_hash: string;
          extraction_status: string;
          selector_status: string;
          consecutive_empty: number;
          content_length: number;
          word_count: number;
          validation_status: string | null;
          validation_failure: string | null;
          parser_version: string;
          structured_content: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_id: string;
          monitored_page_id: string;
          section_type: string;
          section_text: string;
          section_hash: string;
          extraction_status?: string;
          selector_status?: string;
          consecutive_empty?: number;
          content_length?: number;
          word_count?: number;
          validation_status?: string | null;
          validation_failure?: string | null;
          parser_version?: string;
          structured_content?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_id?: string;
          monitored_page_id?: string;
          section_type?: string;
          section_text?: string;
          section_hash?: string;
          extraction_status?: string;
          selector_status?: string;
          consecutive_empty?: number;
          content_length?: number;
          word_count?: number;
          validation_status?: string | null;
          validation_failure?: string | null;
          parser_version?: string;
          structured_content?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "page_sections_snapshot_id_fkey";
            columns: ["snapshot_id"];
            isOneToOne: false;
            referencedRelation: "snapshots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "page_sections_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      section_baselines: {
        Row: {
          id: string;
          monitored_page_id: string;
          section_type: string;
          section_hash: string;
          source_section_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          section_type: string;
          section_hash: string;
          source_section_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          section_type?: string;
          section_hash?: string;
          source_section_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "section_baselines_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      section_diffs: {
        Row: {
          id: string;
          monitored_page_id: string;
          section_type: string;
          previous_section_id: string | null;
          current_section_id: string;
          diff_text: string | null;
          detected_at: string | null;
          signal_detected: boolean | null;
          retry_count: number | null;
          last_error: string | null;
          is_noise: boolean | null;
          noise_reason: string | null;
          status: string | null;
          structured_diff: Json | null;
          confirmation_count: number | null;
          observation_count: number | null;
          confirmed: boolean | null;
          first_seen_at: string | null;
          last_seen_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          section_type: string;
          previous_section_id?: string | null;
          current_section_id: string;
          diff_text?: string | null;
          detected_at?: string | null;
          signal_detected?: boolean | null;
          retry_count?: number | null;
          last_error?: string | null;
          is_noise?: boolean | null;
          noise_reason?: string | null;
          status?: string | null;
          structured_diff?: Json | null;
          confirmation_count?: number | null;
          observation_count?: number | null;
          confirmed?: boolean | null;
          first_seen_at?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          section_type?: string;
          previous_section_id?: string | null;
          current_section_id?: string;
          diff_text?: string | null;
          detected_at?: string | null;
          signal_detected?: boolean | null;
          retry_count?: number | null;
          last_error?: string | null;
          is_noise?: boolean | null;
          noise_reason?: string | null;
          status?: string | null;
          structured_diff?: Json | null;
          confirmation_count?: number | null;
          observation_count?: number | null;
          confirmed?: boolean | null;
          first_seen_at?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "section_diffs_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      signals: {
        Row: {
          id: string;
          section_diff_id: string | null;
          monitored_page_id: string;
          signal_type: string;
          signal_data: Json | null;
          severity: string;
          detected_at: string;
          interpreted: boolean;
          interpreted_at: string | null;
          status: string;
          retry_count: number;
          last_error: string | null;
          is_duplicate: boolean;
          related_signal_id: string | null;
          dedup_hash: string | null;
          confidence_score: number | null;
          signal_hash: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          section_diff_id?: string | null;
          monitored_page_id: string;
          signal_type: string;
          signal_data?: Json | null;
          severity?: string;
          detected_at?: string;
          interpreted?: boolean;
          interpreted_at?: string | null;
          status?: string;
          retry_count?: number;
          last_error?: string | null;
          is_duplicate?: boolean;
          related_signal_id?: string | null;
          dedup_hash?: string | null;
          confidence_score?: number | null;
          signal_hash?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          section_diff_id?: string | null;
          monitored_page_id?: string;
          signal_type?: string;
          signal_data?: Json | null;
          severity?: string;
          detected_at?: string;
          interpreted?: boolean;
          interpreted_at?: string | null;
          status?: string;
          retry_count?: number;
          last_error?: string | null;
          is_duplicate?: boolean;
          related_signal_id?: string | null;
          dedup_hash?: string | null;
          confidence_score?: number | null;
          signal_hash?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signals_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "signals_section_diff_id_fkey";
            columns: ["section_diff_id"];
            isOneToOne: false;
            referencedRelation: "section_diffs";
            referencedColumns: ["id"];
          }
        ];
      };
      interpretations: {
        Row: {
          id: string;
          signal_id: string;
          model_used: string;
          prompt_version: string;
          prompt_hash: string | null;
          change_type: string | null;
          summary: string | null;
          strategic_implication: string | null;
          recommended_action: string | null;
          urgency: number | null;
          confidence: number | null;
          old_content: string | null;
          new_content: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          signal_id: string;
          model_used: string;
          prompt_version: string;
          prompt_hash?: string | null;
          change_type?: string | null;
          summary?: string | null;
          strategic_implication?: string | null;
          recommended_action?: string | null;
          urgency?: number | null;
          confidence?: number | null;
          old_content?: string | null;
          new_content?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          signal_id?: string;
          model_used?: string;
          prompt_version?: string;
          prompt_hash?: string | null;
          change_type?: string | null;
          summary?: string | null;
          strategic_implication?: string | null;
          recommended_action?: string | null;
          urgency?: number | null;
          confidence?: number | null;
          old_content?: string | null;
          new_content?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interpretations_signal_id_fkey";
            columns: ["signal_id"];
            isOneToOne: true;
            referencedRelation: "signals";
            referencedColumns: ["id"];
          }
        ];
      };
      strategic_movements: {
        Row: {
          id: string;
          competitor_id: string;
          movement_type: string;
          confidence: number;
          signal_count: number;
          velocity: number;
          first_seen_at: string | null;
          last_seen_at: string | null;
          summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          movement_type: string;
          confidence?: number;
          signal_count?: number;
          velocity?: number;
          first_seen_at?: string | null;
          last_seen_at?: string | null;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          movement_type?: string;
          confidence?: number;
          signal_count?: number;
          velocity?: number;
          first_seen_at?: string | null;
          last_seen_at?: string | null;
          summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "strategic_movements_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      radar_feed: {
        Row: {
          competitor_id: string;
          competitor_name: string;
          website_url: string | null;
          signals_7d: number;
          weighted_velocity_7d: number;
          last_signal_at: string | null;
          latest_movement_type: string | null;
          latest_movement_confidence: number | null;
          latest_movement_signal_count: number | null;
          latest_movement_velocity: number | null;
          latest_movement_first_seen_at: string | null;
          latest_movement_last_seen_at: string | null;
          latest_movement_summary: string | null;
          momentum_score: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      reset_stuck_signals: {
        Args: { stale_minutes: number };
        Returns: number;
      };
      fail_exhausted_signals: {
        Args: { max_retries: number };
        Returns: number;
      };
      claim_pending_signals: {
        Args: { batch_size: number };
        Returns: Array<{ id: string; signal_type: string; retry_count: number }>;
      };
      build_section_baselines: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      cluster_recent_signals: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      calculate_signal_velocity: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
  };
};
