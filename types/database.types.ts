 WARN  Unsupported engine: wanted: {"node":">=24"} (current: {"node":"v18.20.8","pnpm":"10.33.0"})
Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      audit_logs: {
        Row: {
          action: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      banks: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          document_name: Json | null
          document_number: string | null
          document_slug: string | null
          id: string
          name: string | null
          organization_id: string | null
          slug: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          document_name?: Json | null
          document_number?: string | null
          document_slug?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          slug?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          document_name?: Json | null
          document_number?: string | null
          document_slug?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "banks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_banks: {
        Row: {
          code: string
          created_at: string
          document_name: Json | null
          document_number: string | null
          document_slug: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          code: string
          created_at?: string
          document_name?: Json | null
          document_number?: string | null
          document_slug?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          code?: string
          created_at?: string
          document_name?: Json | null
          document_number?: string | null
          document_slug?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      catalog_documents: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: Json
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: Json
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: Json
          slug?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          document_back_image: string | null
          document_front_image: string | null
          document_id: string | null
          document_name: Json | null
          document_number: string | null
          document_slug: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string | null
          phone: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          document_back_image?: string | null
          document_front_image?: string | null
          document_id?: string | null
          document_name?: Json | null
          document_number?: string | null
          document_slug?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          document_back_image?: string | null
          document_front_image?: string | null
          document_id?: string | null
          document_name?: Json | null
          document_number?: string | null
          document_slug?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string
          currency_code: string | null
          id: string
          iso_numeric: string | null
          iso2: string | null
          iso3: string | null
          name: Json | null
          phone_code: string | null
        }
        Insert: {
          created_at?: string
          currency_code?: string | null
          id?: string
          iso_numeric?: string | null
          iso2?: string | null
          iso3?: string | null
          name?: Json | null
          phone_code?: string | null
        }
        Update: {
          created_at?: string
          currency_code?: string | null
          id?: string
          iso_numeric?: string | null
          iso2?: string | null
          iso3?: string | null
          name?: Json | null
          phone_code?: string | null
        }
        Relationships: []
      }
      document_footers: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_footers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_footers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_headers: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_headers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_headers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string
          html_template: string | null
          id: string
          name: string
          organization_id: string | null
          tiptap_json: Json
          type: string
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          html_template?: string | null
          id?: string
          name: string
          organization_id?: string | null
          tiptap_json?: Json
          type: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          html_template?: string | null
          id?: string
          name?: string
          organization_id?: string | null
          tiptap_json?: Json
          type?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: Json | null
          organization_id: string | null
          slug: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: Json | null
          organization_id?: string | null
          slug?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: Json | null
          organization_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      generated_documents: {
        Row: {
          created_at: string
          document_name: string | null
          file_url: string | null
          html_content: string | null
          id: string
          is_preview: boolean
          legal_process_id: string
          storage_path: string | null
          template_id: string | null
          tiptap_content: Json | null
        }
        Insert: {
          created_at?: string
          document_name?: string | null
          file_url?: string | null
          html_content?: string | null
          id?: string
          is_preview?: boolean
          legal_process_id: string
          storage_path?: string | null
          template_id?: string | null
          tiptap_content?: Json | null
        }
        Update: {
          created_at?: string
          document_name?: string | null
          file_url?: string | null
          html_content?: string | null
          id?: string
          is_preview?: boolean
          legal_process_id?: string
          storage_path?: string | null
          template_id?: string | null
          tiptap_content?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_documents_legal_process_id_fkey"
            columns: ["legal_process_id"]
            isOneToOne: false
            referencedRelation: "legal_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "legal_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_process_banks: {
        Row: {
          access_link: boolean
          access_website: boolean
          bank_id: string | null
          bank_name: string | null
          bank_notification: boolean
          bank_request: string | null
          bank_response: string | null
          bank_slug: string | null
          complait_documents: string | null
          created_at: string
          created_by: string | null
          email: string | null
          file_complait: boolean
          fraud_incident_summary: string | null
          id: string
          last_4_digits: string | null
          latest_account_statement: string | null
          legal_process_id: string
          lost_card: boolean
          no_signal: boolean
          organization_id: string
          used_to_operate_stolen_amount: boolean
        }
        Insert: {
          access_link?: boolean
          access_website?: boolean
          bank_id?: string | null
          bank_name?: string | null
          bank_notification?: boolean
          bank_request?: string | null
          bank_response?: string | null
          bank_slug?: string | null
          complait_documents?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          file_complait?: boolean
          fraud_incident_summary?: string | null
          id?: string
          last_4_digits?: string | null
          latest_account_statement?: string | null
          legal_process_id: string
          lost_card?: boolean
          no_signal?: boolean
          organization_id: string
          used_to_operate_stolen_amount?: boolean
        }
        Update: {
          access_link?: boolean
          access_website?: boolean
          bank_id?: string | null
          bank_name?: string | null
          bank_notification?: boolean
          bank_request?: string | null
          bank_response?: string | null
          bank_slug?: string | null
          complait_documents?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          file_complait?: boolean
          fraud_incident_summary?: string | null
          id?: string
          last_4_digits?: string | null
          latest_account_statement?: string | null
          legal_process_id?: string
          lost_card?: boolean
          no_signal?: boolean
          organization_id?: string
          used_to_operate_stolen_amount?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "legal_process_banks_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_process_banks_legal_process_id_fkey"
            columns: ["legal_process_id"]
            isOneToOne: false
            referencedRelation: "legal_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_process_banks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_process_clients: {
        Row: {
          address: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          document_back_image: string | null
          document_front_image: string | null
          document_id: string | null
          document_name: string | null
          document_number: string | null
          document_slug: string | null
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          legal_process_id: string | null
          organization_id: string | null
          phone: string | null
          doc_validation_status: string | null
          doc_validation_details: Json | null
          doc_validated_at: string | null
        }
        Insert: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_back_image?: string | null
          document_front_image?: string | null
          document_id?: string | null
          document_name?: string | null
          document_number?: string | null
          document_slug?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legal_process_id?: string | null
          organization_id?: string | null
          phone?: string | null
          doc_validation_status?: string | null
          doc_validation_details?: Json | null
          doc_validated_at?: string | null
        }
        Update: {
          address?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          document_back_image?: string | null
          document_front_image?: string | null
          document_id?: string | null
          document_name?: string | null
          document_number?: string | null
          document_slug?: string | null
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legal_process_id?: string | null
          organization_id?: string | null
          phone?: string | null
          doc_validation_status?: string | null
          doc_validation_details?: Json | null
          doc_validated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "legal_process_clients_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_process_clients_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_process_clients_legal_process_id_fkey"
            columns: ["legal_process_id"]
            isOneToOne: false
            referencedRelation: "legal_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_process_clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_processes: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          access_token_used: boolean | null
          assigned_to: string | null
          created_at: string
          created_by: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          id: string
          lawyer_id: string | null
          organization_id: string | null
          process_number: number
          status: string
          workflow_run_id: string | null
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          access_token_used?: boolean | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          lawyer_id?: string | null
          organization_id?: string | null
          process_number: number
          status?: string
          workflow_run_id?: string | null
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          access_token_used?: boolean | null
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          id?: string
          lawyer_id?: string | null
          organization_id?: string | null
          process_number?: number
          status?: string
          workflow_run_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_legal_processes_workflow_run"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_processes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_processes_lawyer_id_fkey"
            columns: ["lawyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_processes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_templates: {
        Row: {
          content: Json | null
          created_at: string
          created_by: string | null
          footer_id: string | null
          header_id: string | null
          id: string
          name: string | null
          organization_id: string | null
          version: number
        }
        Insert: {
          content?: Json | null
          created_at?: string
          created_by?: string | null
          footer_id?: string | null
          header_id?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          version?: number
        }
        Update: {
          content?: Json | null
          created_at?: string
          created_by?: string | null
          footer_id?: string | null
          header_id?: string | null
          id?: string
          name?: string | null
          organization_id?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_templates_footer_id_fkey"
            columns: ["footer_id"]
            isOneToOne: false
            referencedRelation: "document_footers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_templates_header_id_fkey"
            columns: ["header_id"]
            isOneToOne: false
            referencedRelation: "document_headers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_workflows: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          id: string
          is_active: boolean
          organization_id: string
          workflow_template_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          organization_id: string
          workflow_template_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          is_active?: boolean
          organization_id?: string
          workflow_template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_workflows_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_workflows_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_workflows_workflow_template_id_fkey"
            columns: ["workflow_template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          id: string
          legal_name: string | null
          name: string | null
          nit: string | null
          region: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          name?: string | null
          nit?: string | null
          region?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          legal_name?: string | null
          name?: string | null
          nit?: string | null
          region?: string | null
          status?: string | null
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          max_templates: number | null
          max_users: number | null
          name: string | null
          stripe_price_id: string | null
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          max_templates?: number | null
          max_users?: number | null
          name?: string | null
          stripe_price_id?: string | null
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          max_templates?: number | null
          max_users?: number | null
          name?: string | null
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          current_organization_id: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          firstname: string | null
          id: string
          lastname: string | null
          onboarding_status: string | null
          phone: string | null
          system_role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_organization_id?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          firstname?: string | null
          id: string
          lastname?: string | null
          onboarding_status?: string | null
          phone?: string | null
          system_role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_organization_id?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          firstname?: string | null
          id?: string
          lastname?: string | null
          onboarding_status?: string | null
          phone?: string | null
          system_role?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          organization_id: string | null
          plan_id: string | null
          status: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          organization_id?: string | null
          plan_id?: string | null
          status?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_edges: {
        Row: {
          condition: Json | null
          created_at: string
          id: string
          source_handle_id: string | null
          source_node_id: string
          target_handle_id: string | null
          target_node_id: string
          template_id: string
        }
        Insert: {
          condition?: Json | null
          created_at?: string
          id?: string
          source_handle_id?: string | null
          source_node_id: string
          target_handle_id?: string | null
          target_node_id: string
          template_id: string
        }
        Update: {
          condition?: Json | null
          created_at?: string
          id?: string
          source_handle_id?: string | null
          source_node_id?: string
          target_handle_id?: string | null
          target_node_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_source_node"
            columns: ["template_id", "source_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["template_id", "node_id"]
          },
          {
            foreignKeyName: "fk_target_node"
            columns: ["template_id", "target_node_id"]
            isOneToOne: false
            referencedRelation: "workflow_nodes"
            referencedColumns: ["template_id", "node_id"]
          },
          {
            foreignKeyName: "workflow_edges_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_nodes: {
        Row: {
          config: Json
          created_at: string
          id: string
          node_id: string
          position_x: number
          position_y: number
          template_id: string
          title: string
          type: Database["public"]["Enums"]["workflow_node_type"]
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          node_id: string
          position_x?: number
          position_y?: number
          template_id: string
          title: string
          type: Database["public"]["Enums"]["workflow_node_type"]
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          node_id?: string
          position_x?: number
          position_y?: number
          template_id?: string
          title?: string
          type?: Database["public"]["Enums"]["workflow_node_type"]
        }
        Relationships: [
          {
            foreignKeyName: "workflow_nodes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_runs: {
        Row: {
          active_node_ids: string[]
          completed_at: string | null
          created_at: string
          current_node_id: string | null
          id: string
          legal_process_id: string
          status: Database["public"]["Enums"]["workflow_run_status"]
          template_id: string
        }
        Insert: {
          active_node_ids?: string[]
          completed_at?: string | null
          created_at?: string
          current_node_id?: string | null
          id?: string
          legal_process_id: string
          status?: Database["public"]["Enums"]["workflow_run_status"]
          template_id: string
        }
        Update: {
          active_node_ids?: string[]
          completed_at?: string | null
          created_at?: string
          current_node_id?: string | null
          id?: string
          legal_process_id?: string
          status?: Database["public"]["Enums"]["workflow_run_status"]
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_runs_legal_process_id_fkey"
            columns: ["legal_process_id"]
            isOneToOne: false
            referencedRelation: "legal_processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_step_runs: {
        Row: {
          created_at: string
          executed_at: string | null
          id: string
          input: Json
          node_id: string
          output: Json
          status: Database["public"]["Enums"]["workflow_step_run_status"]
          workflow_run_id: string
        }
        Insert: {
          created_at?: string
          executed_at?: string | null
          id?: string
          input?: Json
          node_id: string
          output?: Json
          status?: Database["public"]["Enums"]["workflow_step_run_status"]
          workflow_run_id: string
        }
        Update: {
          created_at?: string
          executed_at?: string | null
          id?: string
          input?: Json
          node_id?: string
          output?: Json
          status?: Database["public"]["Enums"]["workflow_step_run_status"]
          workflow_run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_runs_workflow_run_id_fkey"
            columns: ["workflow_run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          actions: Json
          created_at: string
          description: string | null
          id: string
          next_status: string | null
          order_index: number
          step_type: Database["public"]["Enums"]["workflow_step_type"] | null
          template_id: string
          title: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          description?: string | null
          id?: string
          next_status?: string | null
          order_index: number
          step_type?: Database["public"]["Enums"]["workflow_step_type"] | null
          template_id: string
          title: string
        }
        Update: {
          actions?: Json
          created_at?: string
          description?: string | null
          id?: string
          next_status?: string | null
          order_index?: number
          step_type?: Database["public"]["Enums"]["workflow_step_type"] | null
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_active_legal_process_path: {
        Args: { object_name: string }
        Returns: boolean
      }
      is_org_admin: { Args: { p_org_id: string }; Returns: boolean }
      is_org_member: { Args: { p_org_id: string }; Returns: boolean }
      is_superadmin: { Args: never; Returns: boolean }
    }
    Enums: {
      workflow_node_type:
        | "start"
        | "end"
        | "manual"
        | "client_input"
        | "payment"
        | "ai_generation"
        | "document_generation"
        | "notification"
        | "condition"
        | "delay"
        | "email"
        | "form"
        | "status_update"
        | "generate_document"
        | "manual_action"
        | "send_email"
        | "client_form"
        | "notify_lawyer"
        | "send_documents"
      workflow_run_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "cancelled"
      workflow_step_run_status:
        | "pending"
        | "running"
        | "completed"
        | "failed"
        | "skipped"
      workflow_step_type:
        | "manual"
        | "client_input"
        | "payment"
        | "ai_generation"
        | "ai_wait"
        | "internal_review"
        | "email"
        | "form"
        | "status_update"
        | "generate_document"
        | "manual_action"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      workflow_node_type: [
        "start",
        "end",
        "manual",
        "client_input",
        "payment",
        "ai_generation",
        "document_generation",
        "notification",
        "condition",
        "delay",
        "email",
        "form",
        "status_update",
        "generate_document",
        "manual_action",
        "send_email",
        "client_form",
        "notify_lawyer",
        "send_documents",
      ],
      workflow_run_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      workflow_step_run_status: [
        "pending",
        "running",
        "completed",
        "failed",
        "skipped",
      ],
      workflow_step_type: [
        "manual",
        "client_input",
        "payment",
        "ai_generation",
        "ai_wait",
        "internal_review",
        "email",
        "form",
        "status_update",
        "generate_document",
        "manual_action",
      ],
    },
  },
} as const

A new version of Supabase CLI is available: v2.84.2 (currently installed v2.72.7)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
