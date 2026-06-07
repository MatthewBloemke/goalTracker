import type { Database } from './database';

// ============================================================
// ROW TYPES — derived directly from generated schema
// ============================================================
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Family = Database['public']['Tables']['families']['Row'];
export type FamilyMember =
  Database['public']['Tables']['family_members']['Row'];
export type Loan = Database['public']['Tables']['loans']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type FamilySettings =
  Database['public']['Tables']['family_settings']['Row'];

// INSERT TYPES — for writing to the DB
export type InsertLoan = Database['public']['Tables']['loans']['Insert'];
export type InsertPayment = Database['public']['Tables']['payments']['Insert'];
export type InsertFamily = Database['public']['Tables']['families']['Insert'];
export type InsertFamilyMember =
  Database['public']['Tables']['family_members']['Insert'];
export type InsertFamilySettings =
  Database['public']['Tables']['family_settings']['Insert'];

// UPDATE TYPES
export type UpdateLoan = Database['public']['Tables']['loans']['Update'];

// ============================================================
// ENUM TYPES — derived from generated schema
// ============================================================
export type FamilyRole = Database['public']['Enums']['family_role'];
export type PaymentType = Database['public']['Enums']['payment_type'];
export type SnowballStrategy = Database['public']['Enums']['snowball_strategy'];

// ============================================================
// JOINED TYPES — rows with related data attached
// ============================================================
export type FamilyMemberWithProfile = FamilyMember & {
  profiles: Profile | null;
};
export type MemberWithFamily = FamilyMember & { families: Family };

// ============================================================
// FORM TYPES
// ============================================================
export interface LoanFormValues {
  name: string;
  lender: string;
  original_amount: string;
  current_balance: string;
  interest_rate: string; // user enters "5.25", stored as 0.0525
  min_payment: string;
  family_id: string | null;
}

export interface PaymentFormValues {
  amount: string;
  type: PaymentType;
  note: string;
}

export interface FamilyFormValues {
  name: string;
}

// ============================================================
// COMPUTED / UI TYPES
// ============================================================
export interface LoanWithProjection extends Loan {
  months_remaining: number;
  payoff_date: Date;
  total_interest_remaining: number;
  percent_paid: number;
}

export interface SnowballSummary {
  total_original: number;
  total_current: number;
  total_paid: number;
  percent_complete: number;
  debt_free_date: Date | null;
  projected_total_interest: number;
  ordered_loans: LoanWithProjection[];
  current_target: LoanWithProjection | null;
  next_target: LoanWithProjection | null;
}

// Re-export Database for use in Supabase clients
export type { Database };
