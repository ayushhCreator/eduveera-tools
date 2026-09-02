/**
 * Hand-maintained to match supabase/migrations/*.sql exactly (see
 * DATABASE.md). Once a real Supabase project exists, regenerate with
 * `supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts`
 * and diff against this file before overwriting — it should match.
 *
 * Every Row/Insert/Update shape is inlined directly rather than pulled in
 * via a separate named `interface` — referencing a standalone interface
 * here silently collapses postgrest-js's inferred row type to `never`
 * (confirmed by bisection against this exact @supabase/supabase-js
 * version: an interface-typed `Row: SomeInterface` breaks inference, an
 * identical inline object literal `Row: { ... }` does not).
 * `supabase gen types` output is always fully inlined for the same
 * reason — don't "clean this up" into named interfaces later.
 */

export type ToolName = "image_compressor" | "passport_photo" | "hindi_converter";
export type ToolUsageStatus = "success" | "failed";
export type TransactionType = "credit" | "debit";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type ProfileStatus = "active" | "suspended";

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string | null;
          email: string;
          phone: string | null;
          status: ProfileStatus;
          created_at: string;
        };
        Insert: { id: string; email: string; name?: string | null; phone?: string | null; status?: ProfileStatus };
        Update: { name?: string | null; phone?: string | null };
        Relationships: [];
      };
      credits: {
        Row: { user_id: string; balance: number; updated_at: string };
        Insert: { user_id: string; balance?: number };
        Update: never; // written only via SECURITY DEFINER functions
        Relationships: [];
      };
      credit_transactions: {
        Row: {
          id: string;
          user_id: string;
          type: TransactionType;
          amount: number;
          reason: string;
          reference: string | null;
          balance_after: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: never; // written only via SECURITY DEFINER functions
        Update: never;
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          pricing_plan_id: string;
          amount_inr: string;
          credits_requested: number;
          utr: string | null;
          gateway_payment_id: string | null;
          status: PaymentStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          user_id: string;
          pricing_plan_id: string;
          amount_inr: number;
          credits_requested: number;
          utr: string;
          status?: "pending";
        };
        Update: never; // status transitions only via approve_payment/reject_payment
        Relationships: [];
      };
      tool_usage: {
        Row: {
          id: string;
          user_id: string;
          tool: ToolName;
          status: ToolUsageStatus;
          credits_charged: number;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never; // written only via settle_tool_usage
        Update: never;
        Relationships: [];
      };
      admin_users: {
        Row: { user_id: string; role: string; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pricing_plans: {
        Row: { id: string; label: string; price_inr: string; credits: number; active: boolean; created_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      tool_pricing: {
        Row: { tool: ToolName; cost_credits: number; updated_at: string };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      settle_tool_usage: {
        Args: {
          p_user_id: string;
          p_tool: ToolName;
          p_status: ToolUsageStatus;
          p_metadata?: Record<string, unknown> | null;
        };
        Returns: { new_balance: number; credits_charged: number; tool_usage_id: string }[];
      };
      approve_payment: {
        Args: { p_payment_id: string; p_admin_id: string };
        Returns: { new_balance: number; credits_granted: number }[];
      };
      reject_payment: {
        Args: { p_payment_id: string; p_admin_id: string };
        Returns: undefined;
      };
      admin_adjust_credits: {
        Args: { p_user_id: string; p_admin_id: string; p_amount: number; p_reason: string };
        Returns: { new_balance: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
