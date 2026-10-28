export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          actor_id: string | null
          created_at: string
          id: number
          meme_id: number
          payload: Json
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: never
          meme_id: number
          payload?: Json
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: never
          meme_id?: number
          payload?: Json
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          description: string
          id: number
          name: string
          slug: string
          url: string | null
        }
        Insert: {
          description?: string
          id?: never
          name: string
          slug: string
          url?: string | null
        }
        Update: {
          description?: string
          id?: never
          name?: string
          slug?: string
          url?: string | null
        }
        Relationships: []
      }
      meme_tags: {
        Row: {
          meme_id: number
          tag_id: number
        }
        Insert: {
          meme_id: number
          tag_id: number
        }
        Update: {
          meme_id?: number
          tag_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "meme_tags_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meme_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      memes: {
        Row: {
          alt_text: string
          community_id: number | null
          created_at: string
          description: string
          down_votes: number
          first_seen_at: string | null
          format: string
          id: number
          image_path: string
          image_sha256: string
          is_nsfw: boolean
          language: string
          moderation_note: string | null
          parent_meme_id: number | null
          score: number
          search: unknown
          slug: string
          stage: Database["public"]["Enums"]["stage"]
          status: Database["public"]["Enums"]["meme_status"]
          thumb_path: string
          title: string
          up_votes: number
          updated_at: string
          uploader_id: string | null
        }
        Insert: {
          alt_text: string
          community_id?: number | null
          created_at?: string
          description?: string
          down_votes?: number
          first_seen_at?: string | null
          format?: string
          id?: never
          image_path: string
          image_sha256: string
          is_nsfw?: boolean
          language?: string
          moderation_note?: string | null
          parent_meme_id?: number | null
          score?: number
          search?: unknown
          slug?: string
          stage?: Database["public"]["Enums"]["stage"]
          status?: Database["public"]["Enums"]["meme_status"]
          thumb_path: string
          title: string
          up_votes?: number
          updated_at?: string
          uploader_id?: string | null
        }
        Update: {
          alt_text?: string
          community_id?: number | null
          created_at?: string
          description?: string
          down_votes?: number
          first_seen_at?: string | null
          format?: string
          id?: never
          image_path?: string
          image_sha256?: string
          is_nsfw?: boolean
          language?: string
          moderation_note?: string | null
          parent_meme_id?: number | null
          score?: number
          search?: unknown
          slug?: string
          stage?: Database["public"]["Enums"]["stage"]
          status?: Database["public"]["Enums"]["meme_status"]
          thumb_path?: string
          title?: string
          up_votes?: number
          updated_at?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memes_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memes_parent_meme_id_fkey"
            columns: ["parent_meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memes_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          banned_at: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string
          username: string
        }
        Insert: {
          banned_at?: string | null
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at: string
          username: string
        }
        Update: {
          banned_at?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          terms_accepted_at?: string
          username?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string
          id: number
          meme_id: number
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email: string | null
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          status_token: string
        }
        Insert: {
          created_at?: string
          details?: string
          id?: never
          meme_id: number
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          status_token?: string
        }
        Update: {
          created_at?: string
          details?: string
          id?: never
          meme_id?: number
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_email?: string | null
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          status_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      score_config: {
        Row: {
          age_offset: number
          gravity: number
          id: boolean
          recent_days: number
          w_net: number
          w_recent: number
          w_variants: number
        }
        Insert: {
          age_offset?: number
          gravity?: number
          id?: boolean
          recent_days?: number
          w_net?: number
          w_recent?: number
          w_variants?: number
        }
        Update: {
          age_offset?: number
          gravity?: number
          id?: boolean
          recent_days?: number
          w_net?: number
          w_recent?: number
          w_variants?: number
        }
        Relationships: []
      }
      stage_suggestions: {
        Row: {
          created_at: string
          from_stage: Database["public"]["Enums"]["stage"]
          id: number
          meme_id: number
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["suggestion_status"]
          to_stage: Database["public"]["Enums"]["stage"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          from_stage: Database["public"]["Enums"]["stage"]
          id?: never
          meme_id: number
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          to_stage: Database["public"]["Enums"]["stage"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          from_stage?: Database["public"]["Enums"]["stage"]
          id?: never
          meme_id?: number
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["suggestion_status"]
          to_stage?: Database["public"]["Enums"]["stage"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_suggestions_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_suggestions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          id: number
          name: string
          slug: string
        }
        Insert: {
          id?: never
          name: string
          slug: string
        }
        Update: {
          id?: never
          name?: string
          slug?: string
        }
        Relationships: []
      }
      votes: {
        Row: {
          created_at: string
          meme_id: number
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          meme_id: number
          user_id?: string
          value: number
        }
        Update: {
          created_at?: string
          meme_id?: number
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "votes_meme_id_fkey"
            columns: ["meme_id"]
            isOneToOne: false
            referencedRelation: "memes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      compute_score: {
        Args: { m: Database["public"]["Tables"]["memes"]["Row"] }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      is_curator: { Args: never; Returns: boolean }
      is_member: { Args: never; Returns: boolean }
      my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      next_stage: {
        Args: { s: Database["public"]["Enums"]["stage"] }
        Returns: Database["public"]["Enums"]["stage"]
      }
      refresh_score: { Args: { p_meme: number }; Returns: undefined }
    }
    Enums: {
      activity_type:
        | "created"
        | "approved"
        | "stage_changed"
        | "sighting_added"
        | "voted_milestone"
      meme_status: "pending" | "approved" | "rejected" | "removed"
      report_reason:
        | "copyright"
        | "illegal"
        | "nsfw"
        | "harassment"
        | "spam"
        | "other"
      report_status: "open" | "actioned" | "dismissed"
      stage:
        | "spotted"
        | "rising"
        | "mainstream"
        | "saturated"
        | "cringe"
        | "dead"
        | "revival"
      suggestion_status: "open" | "accepted" | "rejected"
      user_role: "user" | "curator" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      activity_type: [
        "created",
        "approved",
        "stage_changed",
        "sighting_added",
        "voted_milestone",
      ],
      meme_status: ["pending", "approved", "rejected", "removed"],
      report_reason: [
        "copyright",
        "illegal",
        "nsfw",
        "harassment",
        "spam",
        "other",
      ],
      report_status: ["open", "actioned", "dismissed"],
      stage: [
        "spotted",
        "rising",
        "mainstream",
        "saturated",
        "cringe",
        "dead",
        "revival",
      ],
      suggestion_status: ["open", "accepted", "rejected"],
      user_role: ["user", "curator", "admin"],
    },
  },
} as const
