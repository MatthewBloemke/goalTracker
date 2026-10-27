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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      budget_categories: {
        Row: {
          archived_at: string | null
          created_at: string
          group_id: string
          id: string
          is_system: boolean
          loan_id: string | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          group_id: string
          id?: string
          is_system?: boolean
          loan_id?: string | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          group_id?: string
          id?: string
          is_system?: boolean
          loan_id?: string | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "budget_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: true
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_groups: {
        Row: {
          archived_at: string | null
          created_at: string
          family_id: string | null
          id: string
          is_system: boolean
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          is_system?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          family_id?: string | null
          id?: string
          is_system?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_groups_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transaction_splits: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          id: string
          transaction_id: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          id?: string
          transaction_id: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_transaction_splits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "budget_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          family_id: string | null
          id: string
          merchant: string
          note: string | null
          occurred_on: string
          payment_id: string | null
          receipt_storage_path: string | null
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          family_id?: string | null
          id?: string
          merchant: string
          note?: string | null
          occurred_on?: string
          payment_id?: string | null
          receipt_storage_path?: string | null
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          family_id?: string | null
          id?: string
          merchant?: string
          note?: string | null
          occurred_on?: string
          payment_id?: string | null
          receipt_storage_path?: string | null
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          invite_code: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          invite_code?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          invite_code?: string
          name?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          family_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Insert: {
          family_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id: string
        }
        Update: {
          family_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["family_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      family_settings: {
        Row: {
          extra_monthly_budget: number
          family_id: string
          id: string
          strategy: Database["public"]["Enums"]["snowball_strategy"]
          updated_at: string
        }
        Insert: {
          extra_monthly_budget?: number
          family_id: string
          id?: string
          strategy?: Database["public"]["Enums"]["snowball_strategy"]
          updated_at?: string
        }
        Update: {
          extra_monthly_budget?: number
          family_id?: string
          id?: string
          strategy?: Database["public"]["Enums"]["snowball_strategy"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_settings_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: true
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budget_allocations: {
        Row: {
          category_id: string
          created_at: string
          id: string
          monthly_budget_id: string
          planned_amount: number
          rollover_amount: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          monthly_budget_id: string
          planned_amount?: number
          rollover_amount?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          monthly_budget_id?: string
          planned_amount?: number
          rollover_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budget_allocations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_budget_allocations_monthly_budget_id_fkey"
            columns: ["monthly_budget_id"]
            isOneToOne: false
            referencedRelation: "monthly_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_budgets: {
        Row: {
          created_at: string
          created_by: string
          family_id: string | null
          id: string
          income: number
          month: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          family_id?: string | null
          id?: string
          income?: number
          month: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          family_id?: string | null
          id?: string
          income?: number
          month?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_budgets_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          current_balance: number
          family_id: string | null
          id: string
          interest_rate: number
          is_active: boolean
          lender: string | null
          min_payment: number
          name: string
          original_amount: number
          paid_off_at: string | null
          snowball_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_balance: number
          family_id?: string | null
          id?: string
          interest_rate: number
          is_active?: boolean
          lender?: string | null
          min_payment: number
          name: string
          original_amount: number
          paid_off_at?: string | null
          snowball_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          family_id?: string | null
          id?: string
          interest_rate?: number
          is_active?: boolean
          lender?: string | null
          min_payment?: number
          name?: string
          original_amount?: number
          paid_off_at?: string | null
          snowball_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          balance_after: number
          id: string
          loan_id: string
          note: string | null
          paid_at: string
          type: Database["public"]["Enums"]["payment_type"]
          user_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          id?: string
          loan_id: string
          note?: string | null
          paid_at?: string
          type: Database["public"]["Enums"]["payment_type"]
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          id?: string
          loan_id?: string
          note?: string | null
          paid_at?: string
          type?: Database["public"]["Enums"]["payment_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_access_grants: {
        Row: {
          daily_limit: number
          feature: string
          granted_at: string
          granted_by: string | null
          hourly_limit: number
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          daily_limit?: number
          feature: string
          granted_at?: string
          granted_by?: string | null
          hourly_limit?: number
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          daily_limit?: number
          feature?: string
          granted_at?: string
          granted_by?: string | null
          hourly_limit?: number
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          theme_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          theme_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          theme_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      receipt_analysis_requests: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_items: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string
          id: string
          list_id: string
          name: string
          notes: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          list_id: string
          name: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          list_id?: string
          name?: string
          notes?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plan_entries: {
        Row: { id: string; user_id: string; family_id: string | null; recipe_id: string | null; meal_date: string; meal_type: string; title: string; notes: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; family_id?: string | null; recipe_id?: string | null; meal_date: string; meal_type: string; title: string; notes?: string; created_at?: string; updated_at?: string }
        Update: { recipe_id?: string | null; meal_date?: string; meal_type?: string; title?: string; notes?: string }
        Relationships: [{ foreignKeyName: "meal_plan_entries_recipe_id_fkey"; columns: ["recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] }]
      }
      recipes: {
        Row: { id: string; user_id: string; family_id: string | null; title: string; servings: number | null; source_url: string; notes: string; tags: string[]; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; family_id?: string | null; title: string; servings?: number | null; source_url?: string; notes?: string; tags?: string[]; created_at?: string; updated_at?: string }
        Update: { title?: string; servings?: number | null; source_url?: string; notes?: string; tags?: string[] }
        Relationships: []
      }
      recipe_ingredients: {
        Row: { id: string; recipe_id: string; position: number; name: string; quantity: number | null; unit: string; preparation: string; shopping_quantity: number; shopping_unit: string }
        Insert: { id?: string; recipe_id: string; position: number; name: string; quantity?: number | null; unit?: string; preparation?: string; shopping_quantity?: number; shopping_unit?: string }
        Update: { position?: number; name?: string; quantity?: number | null; unit?: string; preparation?: string; shopping_quantity?: number; shopping_unit?: string }
        Relationships: [{ foreignKeyName: "recipe_ingredients_recipe_id_fkey"; columns: ["recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] }]
      }
      recipe_steps: {
        Row: { id: string; recipe_id: string; position: number; instruction: string }
        Insert: { id?: string; recipe_id: string; position: number; instruction: string }
        Update: { position?: number; instruction?: string }
        Relationships: [{ foreignKeyName: "recipe_steps_recipe_id_fkey"; columns: ["recipe_id"]; isOneToOne: false; referencedRelation: "recipes"; referencedColumns: ["id"] }]
      }
      recipe_import_requests: {
        Row: { id: string; user_id: string; created_at: string }
        Insert: { id?: string; user_id: string; created_at?: string }
        Update: { id?: string; user_id?: string; created_at?: string }
        Relationships: []
      }
      task_lists: {
        Row: {
          created_at: string
          family_id: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_lists_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      save_recipe: {
        Args: { recipe_data: Json; target_id?: string | null; target_family_id?: string | null; expected_updated_at?: string | null }
        Returns: string
      }
      add_recipe_to_task_list: {
        Args: { source_recipe_id: string; ingredient_ids: string[]; target_list_id?: string | null; new_list_name?: string }
        Returns: string
      }
      consume_recipe_import_quota: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      can_access_budget_scope: {
        Args: { owner_id: string; fam_id: string | null }
        Returns: boolean
      }
      can_access_portal_scope: {
        Args: { owner_id: string; fam_id: string | null }
        Returns: boolean
      }
      consume_receipt_analysis_quota: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      copy_budget_month: {
        Args: { source_budget_id: string; target_month: string }
        Returns: string
      }
      create_budget_transaction: {
        Args: {
          category_splits: Json
          fam_id: string | null
          owner_id: string
          transaction_amount: number
          transaction_date: string
          transaction_merchant: string
          transaction_note: string
        }
        Returns: string
      }
      record_loan_payment: {
        Args: {
          payment_amount: number
          payment_kind: Database["public"]["Enums"]["payment_type"]
          payment_note?: string | null
          target_loan_id: string
        }
        Returns: string
      }
      reorder_task_items: {
        Args: { ordered_item_ids: string[]; target_list_id: string }
        Returns: undefined
      }
    }
    Enums: {
      family_role: "admin" | "member"
      payment_type: "minimum" | "extra" | "manual"
      snowball_strategy: "snowball" | "avalanche"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      family_role: ["admin", "member"],
      payment_type: ["minimum", "extra", "manual"],
      snowball_strategy: ["snowball", "avalanche"],
    },
  },
} as const
