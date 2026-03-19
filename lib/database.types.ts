// Supabase database types derived from migrations 000–056.
// Re-generate via `supabase gen types typescript` once SUPABASE_ACCESS_TOKEN is available.
//
// Schema constraints (enforced in DB, reflected here for reference):
//   signals.dedup_hash           — UNIQUE partial index WHERE dedup_hash IS NOT NULL (011)
//   signals.signal_hash          — UNIQUE partial index WHERE signal_hash IS NOT NULL (008)
//   signals.section_diff_id      — nullable (056): pool signals have no diff
//   signals.source_type          — CHECK IN ('page_diff','feed_event') (038)
//   section_baselines            — UNIQUE(monitored_page_id, section_type) (011)
//   strategic_movements          — UNIQUE(competitor_id, movement_type) (002)
//   section_diffs                — UNIQUE(monitored_page_id, section_type, previous_section_id) (004)
//   pool_events                  — UNIQUE(competitor_id, content_hash) (038)
//   competitor_feeds             — UNIQUE(competitor_id, pool_type) (038)
//   competitors.domain           — UNIQUE NOT NULL (018)

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
          domain: string;
          active: boolean;
          pressure_index: number;
          last_signal_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          website_url?: string | null;
          domain: string;
          active?: boolean;
          pressure_index?: number;
          last_signal_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          website_url?: string | null;
          domain?: string;
          active?: boolean;
          pressure_index?: number;
          last_signal_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tracked_competitors: {
        Row: {
          id: string;
          org_id: string;
          competitor_id: string | null;
          name: string;
          website_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          competitor_id?: string | null;
          name: string;
          website_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          competitor_id?: string | null;
          name?: string;
          website_url?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tracked_competitors_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
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
          health_state: string;
          last_fetched_at: string | null;
          discovery_candidates: Json | null;
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
          health_state?: string;
          last_fetched_at?: string | null;
          discovery_candidates?: Json | null;
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
          health_state?: string;
          last_fetched_at?: string | null;
          discovery_candidates?: Json | null;
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
          raw_html: string | null;
          extracted_text: string | null;
          content_hash: string;
          status: string;
          fetch_quality: string;
          sections_extracted: boolean;
          sections_extracted_at: string | null;
          is_duplicate: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          monitored_page_id: string;
          fetched_at: string;
          raw_html?: string | null;
          extracted_text?: string | null;
          content_hash: string;
          status?: string;
          fetch_quality?: string;
          sections_extracted?: boolean;
          sections_extracted_at?: string | null;
          is_duplicate?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          monitored_page_id?: string;
          fetched_at?: string;
          raw_html?: string | null;
          extracted_text?: string | null;
          content_hash?: string;
          status?: string;
          fetch_quality?: string;
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
          page_class: string;
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
          page_class?: string;
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
          page_class?: string;
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
          competitor_id: string | null;
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
          relevance_level: string | null;
          relevance_rationale: string | null;
          source_type: string;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id?: string | null;
          section_diff_id?: string | null;
          monitored_page_id?: string | null;
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
          relevance_level?: string | null;
          relevance_rationale?: string | null;
          source_type?: string;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string | null;
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
          relevance_level?: string | null;
          relevance_rationale?: string | null;
          source_type?: string;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "signals_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
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
          movement_summary: string | null;
          movement_strategic_implication: string | null;
          strategic_implication: string | null;
          confidence_level: string | null;
          confidence_reason: string | null;
          narrative_generated_at: string | null;
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
          movement_summary?: string | null;
          movement_strategic_implication?: string | null;
          strategic_implication?: string | null;
          confidence_level?: string | null;
          confidence_reason?: string | null;
          narrative_generated_at?: string | null;
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
          movement_summary?: string | null;
          movement_strategic_implication?: string | null;
          strategic_implication?: string | null;
          confidence_level?: string | null;
          confidence_reason?: string | null;
          narrative_generated_at?: string | null;
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
      pipeline_events: {
        Row: {
          id: string;
          created_at: string;
          run_id: string | null;
          stage: string;
          status: string;
          monitored_page_id: string | null;
          snapshot_id: string | null;
          section_diff_id: string | null;
          duration_ms: number | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          created_at?: string;
          run_id?: string | null;
          stage: string;
          status: string;
          monitored_page_id?: string | null;
          snapshot_id?: string | null;
          section_diff_id?: string | null;
          duration_ms?: number | null;
          metadata?: Json;
        };
        Update: {
          id?: string;
          created_at?: string;
          run_id?: string | null;
          stage?: string;
          status?: string;
          monitored_page_id?: string | null;
          snapshot_id?: string | null;
          section_diff_id?: string | null;
          duration_ms?: number | null;
          metadata?: Json;
        };
        Relationships: [];
      };
      signal_feedback: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          signal_id: string;
          verdict: string;
          noise_category: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          signal_id: string;
          verdict: string;
          noise_category?: string | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          signal_id?: string;
          verdict?: string;
          noise_category?: string | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "signal_feedback_signal_id_fkey";
            columns: ["signal_id"];
            isOneToOne: false;
            referencedRelation: "signals";
            referencedColumns: ["id"];
          }
        ];
      };
      selector_repair_suggestions: {
        Row: {
          id: string;
          created_at: string;
          monitored_page_id: string;
          section_type: string;
          previous_selector: string;
          proposed_selector: string;
          test_extraction_content: string | null;
          confidence: number | null;
          rationale: string | null;
          snapshot_id: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          created_at?: string;
          monitored_page_id: string;
          section_type: string;
          previous_selector: string;
          proposed_selector: string;
          test_extraction_content?: string | null;
          confidence?: number | null;
          rationale?: string | null;
          snapshot_id?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          created_at?: string;
          monitored_page_id?: string;
          section_type?: string;
          previous_selector?: string;
          proposed_selector?: string;
          test_extraction_content?: string | null;
          confidence?: number | null;
          rationale?: string | null;
          snapshot_id?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "selector_repair_suggestions_monitored_page_id_fkey";
            columns: ["monitored_page_id"];
            isOneToOne: false;
            referencedRelation: "monitored_pages";
            referencedColumns: ["id"];
          }
        ];
      };
      radar_narratives: {
        Row: {
          id: string;
          competitor_id: string;
          created_at: string;
          pressure_index: number | null;
          signal_count: number | null;
          narrative: string;
          evidence_signal_ids: string[] | null;
          generation_reason: string | null;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          created_at?: string;
          pressure_index?: number | null;
          signal_count?: number | null;
          narrative: string;
          evidence_signal_ids?: string[] | null;
          generation_reason?: string | null;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          created_at?: string;
          pressure_index?: number | null;
          signal_count?: number | null;
          narrative?: string;
          evidence_signal_ids?: string[] | null;
          generation_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "radar_narratives_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
      sector_intelligence: {
        Row: {
          id: string;
          org_id: string;
          created_at: string;
          sector: string;
          analysis_window_days: number;
          competitor_count: number;
          signal_count: number;
          sector_trends: Json;
          divergences: Json;
          summary: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          created_at?: string;
          sector: string;
          analysis_window_days?: number;
          competitor_count: number;
          signal_count: number;
          sector_trends?: Json;
          divergences?: Json;
          summary?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          created_at?: string;
          sector?: string;
          analysis_window_days?: number;
          competitor_count?: number;
          signal_count?: number;
          sector_trends?: Json;
          divergences?: Json;
          summary?: string | null;
        };
        Relationships: [];
      };
      weekly_briefs: {
        Row: {
          id: string;
          org_id: string;
          content: Json | null;
          signal_count: number | null;
          generated_at: string | null;
          sector_summary: string | null;
          movements: Json;
          activity: Json;
          brief_markdown: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          content?: Json | null;
          signal_count?: number | null;
          generated_at?: string | null;
          sector_summary?: string | null;
          movements?: Json;
          activity?: Json;
          brief_markdown?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          content?: Json | null;
          signal_count?: number | null;
          generated_at?: string | null;
          sector_summary?: string | null;
          movements?: Json;
          activity?: Json;
          brief_markdown?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      radar_positions: {
        Row: {
          id: string;
          competitor_id: string;
          org_id: string;
          x: number;
          y: number;
          pressure_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          org_id: string;
          x: number;
          y: number;
          pressure_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          org_id?: string;
          x?: number;
          y?: number;
          pressure_index?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "radar_positions_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
      pool_events: {
        Row: {
          id: string;
          created_at: string;
          competitor_id: string;
          source_type: string;
          source_url: string;
          event_type: string;
          title: string;
          summary: string | null;
          event_url: string | null;
          published_at: string | null;
          content_hash: string;
          raw_payload: Json | null;
          normalization_status: string;
          suppression_reason: string | null;
          promoted_signal_id: string | null;
          external_event_id: string | null;
          department: string | null;
          location: string | null;
          employment_type: string | null;
          department_normalized: string | null;
          // Pool-specific columns (migrations 040–043)
          awardee_name: string | null;
          contract_value: number | null;
          contract_id: string | null;
          buyer_name: string | null;
          program_name: string | null;
          procurement_event_type: string | null;
          currency: string | null;
          region: string | null;
          investor_event_type: string | null;
          version_tag: string | null;
          product_event_type: string | null;
          filing_type: string | null;
          filing_id: string | null;
          regulatory_body: string | null;
          jurisdiction: string | null;
          regulatory_event_type: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          competitor_id: string;
          source_type: string;
          source_url: string;
          event_type?: string;
          title: string;
          summary?: string | null;
          event_url?: string | null;
          published_at?: string | null;
          content_hash: string;
          raw_payload?: Json | null;
          normalization_status?: string;
          suppression_reason?: string | null;
          promoted_signal_id?: string | null;
          external_event_id?: string | null;
          department?: string | null;
          location?: string | null;
          employment_type?: string | null;
          department_normalized?: string | null;
          awardee_name?: string | null;
          contract_value?: number | null;
          contract_id?: string | null;
          buyer_name?: string | null;
          program_name?: string | null;
          procurement_event_type?: string | null;
          currency?: string | null;
          region?: string | null;
          investor_event_type?: string | null;
          version_tag?: string | null;
          product_event_type?: string | null;
          filing_type?: string | null;
          filing_id?: string | null;
          regulatory_body?: string | null;
          jurisdiction?: string | null;
          regulatory_event_type?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          competitor_id?: string;
          source_type?: string;
          source_url?: string;
          event_type?: string;
          title?: string;
          summary?: string | null;
          event_url?: string | null;
          published_at?: string | null;
          content_hash?: string;
          raw_payload?: Json | null;
          normalization_status?: string;
          suppression_reason?: string | null;
          promoted_signal_id?: string | null;
          external_event_id?: string | null;
          department?: string | null;
          location?: string | null;
          employment_type?: string | null;
          department_normalized?: string | null;
          awardee_name?: string | null;
          contract_value?: number | null;
          contract_id?: string | null;
          buyer_name?: string | null;
          program_name?: string | null;
          procurement_event_type?: string | null;
          currency?: string | null;
          region?: string | null;
          investor_event_type?: string | null;
          version_tag?: string | null;
          product_event_type?: string | null;
          filing_type?: string | null;
          filing_id?: string | null;
          regulatory_body?: string | null;
          jurisdiction?: string | null;
          regulatory_event_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pool_events_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pool_events_promoted_signal_id_fkey";
            columns: ["promoted_signal_id"];
            isOneToOne: false;
            referencedRelation: "signals";
            referencedColumns: ["id"];
          }
        ];
      };
      competitor_feeds: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          competitor_id: string;
          feed_url: string | null;
          source_type: string;
          pool_type: string;
          discovery_status: string;
          discovered_at: string | null;
          last_fetched_at: string | null;
          last_error: string | null;
          consecutive_failures: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          competitor_id: string;
          feed_url?: string | null;
          source_type?: string;
          pool_type?: string;
          discovery_status?: string;
          discovered_at?: string | null;
          last_fetched_at?: string | null;
          last_error?: string | null;
          consecutive_failures?: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          updated_at?: string;
          competitor_id?: string;
          feed_url?: string | null;
          source_type?: string;
          pool_type?: string;
          discovery_status?: string;
          discovered_at?: string | null;
          last_fetched_at?: string | null;
          last_error?: string | null;
          consecutive_failures?: number;
        };
        Relationships: [
          {
            foreignKeyName: "competitor_feeds_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
      media_observations: {
        Row: {
          id: string;
          created_at: string;
          sector: string;
          source_name: string;
          title: string;
          url: string | null;
          published_at: string | null;
          content_hash: string;
          keywords: string[];
        };
        Insert: {
          id?: string;
          created_at?: string;
          sector: string;
          source_name: string;
          title: string;
          url?: string | null;
          published_at?: string | null;
          content_hash: string;
          keywords?: string[];
        };
        Update: {
          id?: string;
          created_at?: string;
          sector?: string;
          source_name?: string;
          title?: string;
          url?: string | null;
          published_at?: string | null;
          content_hash?: string;
          keywords?: string[];
        };
        Relationships: [];
      };
      sector_narratives: {
        Row: {
          id: string;
          created_at: string;
          sector: string;
          theme_label: string;
          keywords: string[];
          source_count: number;
          article_count: number;
          representative_urls: string[];
          first_detected_at: string;
          last_detected_at: string;
          confidence_score: number;
        };
        Insert: {
          id?: string;
          created_at?: string;
          sector: string;
          theme_label: string;
          keywords?: string[];
          source_count: number;
          article_count: number;
          representative_urls?: string[];
          first_detected_at: string;
          last_detected_at: string;
          confidence_score: number;
        };
        Update: {
          id?: string;
          created_at?: string;
          sector?: string;
          theme_label?: string;
          keywords?: string[];
          source_count?: number;
          article_count?: number;
          representative_urls?: string[];
          first_detected_at?: string;
          last_detected_at?: string;
          confidence_score?: number;
        };
        Relationships: [];
      };
      competitor_contexts: {
        Row: {
          id: string;
          competitor_id: string;
          org_id: string;
          competitor_name: string;
          hypothesis: string | null;
          confidence_level: string;
          evidence_trail: Json;
          open_questions: Json;
          strategic_arc: string | null;
          signal_count: number;
          last_updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          competitor_id: string;
          org_id: string;
          competitor_name: string;
          hypothesis?: string | null;
          confidence_level?: string;
          evidence_trail?: Json;
          open_questions?: Json;
          strategic_arc?: string | null;
          signal_count?: number;
          last_updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          competitor_id?: string;
          org_id?: string;
          competitor_name?: string;
          hypothesis?: string | null;
          confidence_level?: string;
          evidence_trail?: Json;
          open_questions?: Json;
          strategic_arc?: string | null;
          signal_count?: number;
          last_updated_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competitor_contexts_competitor_id_fkey";
            columns: ["competitor_id"];
            isOneToOne: false;
            referencedRelation: "competitors";
            referencedColumns: ["id"];
          }
        ];
      };
      strategic_actions: {
        Row: {
          id: string;
          org_id: string;
          action_type: string;
          urgency: string;
          priority: number;
          title: string;
          description: string;
          rationale: string | null;
          competitor_names: string[];
          status: string;
          generated_at: string;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          action_type: string;
          urgency: string;
          priority: number;
          title: string;
          description: string;
          rationale?: string | null;
          competitor_names?: string[];
          status?: string;
          generated_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          action_type?: string;
          urgency?: string;
          priority?: number;
          title?: string;
          description?: string;
          rationale?: string | null;
          competitor_names?: string[];
          status?: string;
          generated_at?: string;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      calibration_reports: {
        Row: {
          id: string;
          computed_at: string;
          signal_count: number;
          applied_count: number;
          section_stats: Json;
        };
        Insert: {
          id?: string;
          computed_at?: string;
          signal_count?: number;
          applied_count?: number;
          section_stats?: Json;
        };
        Update: {
          id?: string;
          computed_at?: string;
          signal_count?: number;
          applied_count?: number;
          section_stats?: Json;
        };
        Relationships: [];
      };
    };
    Views: {
      radar_feed: {
        Row: {
          competitor_id: string;
          competitor_name: string;
          website_url: string | null;
          signals_7d: number;
          signals_pending: number;
          weighted_velocity_7d: number;
          last_signal_at: string | null;
          pressure_index: number;
          latest_movement_type: string | null;
          latest_movement_confidence: number | null;
          latest_movement_signal_count: number | null;
          latest_movement_velocity: number | null;
          latest_movement_first_seen_at: string | null;
          latest_movement_last_seen_at: string | null;
          latest_movement_summary: string | null;
          latest_signal_type: string | null;
          momentum_score: number;
          radar_narrative: string | null;
          radar_narrative_signal_count: number | null;
          radar_narrative_generation_reason: string | null;
          latest_interpretation_summary: string | null;
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
        Args: { batch_limit?: number };
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
      prune_activity_events: {
        Args: { retain_days?: number };
        Returns: number;
      };
      prune_old_snapshots: {
        Args: { retain_days?: number };
        Returns: number;
      };
      prune_old_section_diffs: {
        Args: { retain_days_clean?: number; retain_days_noise?: number };
        Returns: number;
      };
      promote_section_baselines: {
        Args: { dry_run?: boolean };
        Returns: Array<{ promoted_count: number; pairs_evaluated: number }>;
      };
      retention_null_raw_html: {
        Args: { cutoff_days: number };
        Returns: number;
      };
      retention_delete_sections: {
        Args: { cutoff_days: number };
        Returns: number;
      };
      retention_delete_diffs: {
        Args: { cutoff_days: number };
        Returns: number;
      };
      retention_delete_pipeline_events: {
        Args: { cutoff_days: number };
        Returns: number;
      };
    };
  };
};
