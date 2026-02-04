export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      evolution_api_configs: {
        Row: {
          id: string
          tenant_id: string
          name: string
          url: string
          api_key_encrypted: string
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          url: string
          api_key_encrypted: string
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          url?: string
          api_key_encrypted?: string
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      super_admins: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          permissions: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email: string
          permissions?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string
          permissions?: Json | null
          created_at?: string | null
        }
      }
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          plan: string | null
          status: string | null
          max_users: number | null
          max_leads: number | null
          max_whatsapp_instances: number | null
          max_campaigns_per_month: number | null
          monthly_price: number | null
          trial_ends_at: string | null
          settings: Json | null
          timezone: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          plan?: string | null
          status?: string | null
          max_users?: number | null
          max_leads?: number | null
          max_whatsapp_instances?: number | null
          max_campaigns_per_month?: number | null
          monthly_price?: number | null
          trial_ends_at?: string | null
          settings?: Json | null
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          logo_url?: string | null
          plan?: string | null
          status?: string | null
          max_users?: number | null
          max_leads?: number | null
          max_whatsapp_instances?: number | null
          max_campaigns_per_month?: number | null
          monthly_price?: number | null
          trial_ends_at?: string | null
          settings?: Json | null
          timezone?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tenant_users: {
        Row: {
          id: string
          tenant_id: string | null
          user_id: string | null
          name: string
          email: string
          avatar_url: string | null
          role: string | null
          status: string | null
          last_login_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          name: string
          email: string
          avatar_url?: string | null
          role?: string | null
          status?: string | null
          last_login_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          name?: string
          email?: string
          avatar_url?: string | null
          role?: string | null
          status?: string | null
          last_login_at?: string | null
          created_at?: string | null
        }
      }
      lead_sources: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          type: string
          webhook_url: string | null
          webhook_secret: string | null
          webhook_verified: boolean | null
          field_mapping: Json | null
          total_leads: number | null
          active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          type: string
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_verified?: boolean | null
          field_mapping?: Json | null
          total_leads?: number | null
          active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          type?: string
          webhook_url?: string | null
          webhook_secret?: string | null
          webhook_verified?: boolean | null
          field_mapping?: Json | null
          total_leads?: number | null
          active?: boolean | null
          created_at?: string | null
        }
      }
      leads: {
        Row: {
          id: string
          tenant_id: string | null
          source_id: string | null
          external_id: string | null
          name: string
          email: string | null
          phone: string | null
          cpf: string | null
          status: string | null
          score: number | null
          tags: string[] | null
          custom_fields: Json | null
          assigned_to: string | null
          created_at: string | null
          updated_at: string | null
          board_id: string | null
          stage_id: string | null
          source: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          source_id?: string | null
          external_id?: string | null
          name: string
          email?: string | null
          phone?: string | null
          cpf?: string | null
          status?: string | null
          score?: number | null
          tags?: string[] | null
          custom_fields?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          updated_at?: string | null
          board_id?: string | null
          stage_id?: string | null
          source?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          source_id?: string | null
          external_id?: string | null
          name?: string
          email?: string | null
          phone?: string | null
          cpf?: string | null
          status?: string | null
          score?: number | null
          tags?: string[] | null
          custom_fields?: Json | null
          assigned_to?: string | null
          created_at?: string | null
          updated_at?: string | null
          board_id?: string | null
          stage_id?: string | null
          source?: string | null
        }
      }
      lead_notes: {
        Row: {
          id: string
          lead_id: string | null
          user_id: string | null
          content: string
          pinned: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          content: string
          pinned?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          content?: string
          pinned?: boolean | null
          created_at?: string | null
        }
      }
      lead_activities: {
        Row: {
          id: string
          lead_id: string | null
          user_id: string | null
          type: string
          content: string | null
          metadata: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          type: string
          content?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          lead_id?: string | null
          user_id?: string | null
          type?: string
          content?: string | null
          metadata?: Json | null
          created_at?: string | null
        }
      }
      whatsapp_instances: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          instance_name: string
          instance_token: string
          status: string | null
          phone_number: string | null
          qrcode: string | null
          color: string | null
          evolution_api_url: string | null
          evolution_config_id: string | null
          total_messages_sent: number | null
          last_connected_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          instance_name: string
          instance_token: string
          status?: string | null
          phone_number?: string | null
          qrcode?: string | null
          color?: string | null
          evolution_api_url?: string | null
          evolution_config_id?: string | null
          total_messages_sent?: number | null
          last_connected_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          instance_name?: string
          instance_token?: string
          status?: string | null
          phone_number?: string | null
          qrcode?: string | null
          color?: string | null
          evolution_api_url?: string | null
          evolution_config_id?: string | null
          total_messages_sent?: number | null
          last_connected_at?: string | null
          created_at?: string | null
        }
      }
      chats: {
        Row: {
          id: string
          tenant_id: string | null
          lead_id: string | null
          instance_id: string | null
          remote_jid: string
          contact_name: string | null
          last_message: string | null
          last_message_from_me: boolean | null
          last_message_at: string | null
          unread_count: number | null
          archived: boolean | null
          assigned_to: string | null
          tags: string[] | null
          created_at: string | null
          board_id: string | null
          stage_id: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          lead_id?: string | null
          instance_id?: string | null
          remote_jid: string
          contact_name?: string | null
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_at?: string | null
          unread_count?: number | null
          archived?: boolean | null
          assigned_to?: string | null
          tags?: string[] | null
          created_at?: string | null
          board_id?: string | null
          stage_id?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          lead_id?: string | null
          instance_id?: string | null
          remote_jid?: string
          contact_name?: string | null
          last_message?: string | null
          last_message_from_me?: boolean | null
          last_message_at?: string | null
          unread_count?: number | null
          archived?: boolean | null
          assigned_to?: string | null
          tags?: string[] | null
          created_at?: string | null
          board_id?: string | null
          stage_id?: string | null
        }
      }
      messages: {
        Row: {
          id: string
          chat_id: string | null
          message_id: string | null
          from_me: boolean | null
          remote_jid: string
          message_type: string | null
          content: string | null
          media_url: string | null
          status: string | null
          timestamp: string | null
          created_at: string | null
          participant_jid: string | null
          participant_name: string | null
        }
        Insert: {
          id?: string
          chat_id?: string | null
          message_id?: string | null
          from_me?: boolean | null
          remote_jid: string
          message_type?: string | null
          content?: string | null
          media_url?: string | null
          status?: string | null
          timestamp?: string | null
          created_at?: string | null
          participant_jid?: string | null
          participant_name?: string | null
        }
        Update: {
          id?: string
          chat_id?: string | null
          message_id?: string | null
          from_me?: boolean | null
          remote_jid?: string
          message_type?: string | null
          content?: string | null
          media_url?: string | null
          status?: string | null
          timestamp?: string | null
          created_at?: string | null
          participant_jid?: string | null
          participant_name?: string | null
        }
      }
      campaigns: {
        Row: {
          id: string
          tenant_id: string | null
          instance_id: string | null
          name: string
          message_template: string
          status: string | null
          scheduled_at: string | null
          started_at: string | null
          completed_at: string | null
          source_ids: string[] | null
          lead_status: string[] | null
          tags: string[] | null
          total_recipients: number | null
          sent_count: number | null
          delivered_count: number | null
          read_count: number | null
          failed_count: number | null
          estimated_cost: number | null
          actual_cost: number | null
          created_by: string | null
          created_at: string | null
          modal_job_id: string | null
          modal_job_status: string | null
          delay_between_messages: number | null
          delay_between_recipients: number | null
          filter_criteria: Json | null
          error_log: string[] | null
          settings: Json | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name: string
          message_template?: string
          status?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_recipients?: number | null
          sent_count?: number | null
          delivered_count?: number | null
          read_count?: number | null
          failed_count?: number | null
          estimated_cost?: number | null
          actual_cost?: number | null
          created_by?: string | null
          created_at?: string | null
          modal_job_id?: string | null
          modal_job_status?: string | null
          delay_between_messages?: number | null
          delay_between_recipients?: number | null
          filter_criteria?: Json | null
          error_log?: string[] | null
          settings?: Json | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name?: string
          message_template?: string
          status?: string | null
          scheduled_at?: string | null
          started_at?: string | null
          completed_at?: string | null
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_recipients?: number | null
          sent_count?: number | null
          delivered_count?: number | null
          read_count?: number | null
          failed_count?: number | null
          estimated_cost?: number | null
          actual_cost?: number | null
          created_by?: string | null
          created_at?: string | null
          modal_job_id?: string | null
          modal_job_status?: string | null
          delay_between_messages?: number | null
          delay_between_recipients?: number | null
          filter_criteria?: Json | null
          error_log?: string[] | null
          settings?: Json | null
        }
      }
      campaign_messages: {
        Row: {
          id: string
          campaign_id: string
          position: number
          message_type: string | null
          content: string | null
          media_url: string | null
          media_mimetype: string | null
          file_name: string | null
          delay_after: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          campaign_id: string
          position?: number
          message_type?: string | null
          content?: string | null
          media_url?: string | null
          media_mimetype?: string | null
          file_name?: string | null
          delay_after?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          campaign_id?: string
          position?: number
          message_type?: string | null
          content?: string | null
          media_url?: string | null
          media_mimetype?: string | null
          file_name?: string | null
          delay_after?: number | null
          created_at?: string | null
        }
      }
      campaign_send_messages: {
        Row: {
          id: string
          campaign_send_id: string | null
          campaign_message_id: string | null
          message_id: string | null
          status: string | null
          sent_at: string | null
          error_message: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          campaign_send_id?: string | null
          campaign_message_id?: string | null
          message_id?: string | null
          status?: string | null
          sent_at?: string | null
          error_message?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          campaign_send_id?: string | null
          campaign_message_id?: string | null
          message_id?: string | null
          status?: string | null
          sent_at?: string | null
          error_message?: string | null
          created_at?: string | null
        }
      }
      campaign_sends: {
        Row: {
          id: string
          campaign_id: string | null
          lead_id: string | null
          phone: string | null
          message_id: string | null
          status: string | null
          error_message: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          created_at: string | null
          current_message_index: number | null
          messages_sent: number | null
          total_messages: number | null
          retry_count: number | null
        }
        Insert: {
          id?: string
          campaign_id?: string | null
          lead_id?: string | null
          phone?: string | null
          message_id?: string | null
          status?: string | null
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string | null
          current_message_index?: number | null
          messages_sent?: number | null
          total_messages?: number | null
          retry_count?: number | null
        }
        Update: {
          id?: string
          campaign_id?: string | null
          lead_id?: string | null
          phone?: string | null
          message_id?: string | null
          status?: string | null
          error_message?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          created_at?: string | null
          current_message_index?: number | null
          messages_sent?: number | null
          total_messages?: number | null
          retry_count?: number | null
        }
      }
      contact_lists: {
        Row: {
          id: string
          tenant_id: string | null
          name: string
          description: string | null
          total_contacts: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          name: string
          description?: string | null
          total_contacts?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          name?: string
          description?: string | null
          total_contacts?: number | null
          created_at?: string | null
        }
      }
      contact_list_members: {
        Row: {
          id: string
          list_id: string | null
          lead_id: string | null
          added_at: string | null
        }
        Insert: {
          id?: string
          list_id?: string | null
          lead_id?: string | null
          added_at?: string | null
        }
        Update: {
          id?: string
          list_id?: string | null
          lead_id?: string | null
          added_at?: string | null
        }
      }
      automations: {
        Row: {
          id: string
          tenant_id: string | null
          instance_id: string | null
          name: string
          status: string | null
          trigger_type: string
          trigger_config: Json | null
          actions: Json
          source_ids: string[] | null
          lead_status: string[] | null
          tags: string[] | null
          total_executions: number | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name: string
          status?: string | null
          trigger_type: string
          trigger_config?: Json | null
          actions: Json
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_executions?: number | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          instance_id?: string | null
          name?: string
          status?: string | null
          trigger_type?: string
          trigger_config?: Json | null
          actions?: Json
          source_ids?: string[] | null
          lead_status?: string[] | null
          tags?: string[] | null
          total_executions?: number | null
          created_by?: string | null
          created_at?: string | null
        }
      }
      automation_executions: {
        Row: {
          id: string
          automation_id: string | null
          lead_id: string | null
          status: string | null
          error_message: string | null
          started_at: string | null
          completed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          automation_id?: string | null
          lead_id?: string | null
          status?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          automation_id?: string | null
          lead_id?: string | null
          status?: string | null
          error_message?: string | null
          started_at?: string | null
          completed_at?: string | null
          created_at?: string | null
        }
      }
      wallets: {
        Row: {
          id: string
          tenant_id: string | null
          balance: number | null
          total_spent: number | null
          total_added: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          balance?: number | null
          total_spent?: number | null
          total_added?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          balance?: number | null
          total_spent?: number | null
          total_added?: number | null
          created_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          wallet_id: string | null
          type: string
          amount: number
          description: string | null
          reference_id: string | null
          reference_type: string | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          wallet_id?: string | null
          type: string
          amount: number
          description?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          wallet_id?: string | null
          type?: string
          amount?: number
          description?: string | null
          reference_id?: string | null
          reference_type?: string | null
          created_by?: string | null
          created_at?: string | null
        }
      }
      platform_metrics: {
        Row: {
          id: string
          metric_date: string
          total_tenants: number | null
          active_tenants: number | null
          total_leads: number | null
          total_messages_sent: number | null
          mrr: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          metric_date: string
          total_tenants?: number | null
          active_tenants?: number | null
          total_leads?: number | null
          total_messages_sent?: number | null
          mrr?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          metric_date?: string
          total_tenants?: number | null
          active_tenants?: number | null
          total_leads?: number | null
          total_messages_sent?: number | null
          mrr?: number | null
          created_at?: string | null
        }
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string | null
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string | null
          user_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          created_at?: string | null
        }
      }
      webhook_events: {
        Row: {
          id: string
          source_id: string | null
          event_type: string | null
          payload: Json
          signature_valid: boolean | null
          processed: boolean | null
          error_message: string | null
          received_at: string | null
        }
        Insert: {
          id?: string
          source_id?: string | null
          event_type?: string | null
          payload: Json
          signature_valid?: boolean | null
          processed?: boolean | null
          error_message?: string | null
          received_at?: string | null
        }
        Update: {
          id?: string
          source_id?: string | null
          event_type?: string | null
          payload?: Json
          signature_valid?: boolean | null
          processed?: boolean | null
          error_message?: string | null
          received_at?: string | null
        }
      }
      webhook_forwards: {
        Row: {
          id: string
          instance_id: string
          tenant_id: string
          name: string
          target_url: string
          headers: Json | null
          events: string[] | null
          is_active: boolean | null
          last_success_at: string | null
          last_error_at: string | null
          last_error_message: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          instance_id: string
          tenant_id: string
          name: string
          target_url: string
          headers?: Json | null
          events?: string[] | null
          is_active?: boolean | null
          last_success_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          instance_id?: string
          tenant_id?: string
          name?: string
          target_url?: string
          headers?: Json | null
          events?: string[] | null
          is_active?: boolean | null
          last_success_at?: string | null
          last_error_at?: string | null
          last_error_message?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      kanban_boards: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          entity_type: string
          filters: Json | null
          is_default: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          description?: string | null
          entity_type?: string
          filters?: Json | null
          is_default?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          description?: string | null
          entity_type?: string
          filters?: Json | null
          is_default?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      kanban_stages: {
        Row: {
          id: string
          board_id: string
          name: string
          color: string | null
          position: number
          created_at: string | null
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          color?: string | null
          position?: number
          created_at?: string | null
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          color?: string | null
          position?: number
          created_at?: string | null
        }
      }
      saved_filters: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          name: string
          entity_type: string
          filters: Json
          is_default: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          user_id?: string | null
          name: string
          entity_type: string
          filters?: Json
          is_default?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          user_id?: string | null
          name?: string
          entity_type?: string
          filters?: Json
          is_default?: boolean | null
          created_at?: string | null
        }
      }
      warming_configs: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          status: 'active' | 'inactive' | 'paused'
          run_24h: boolean
          start_time: string
          end_time: string
          days_of_week: number[]
          timezone: string
          text_messages_enabled: boolean
          text_messages_weight: number
          audio_messages_enabled: boolean
          audio_messages_weight: number
          image_messages_enabled: boolean
          image_messages_weight: number
          document_messages_enabled: boolean
          document_messages_weight: number
          video_messages_enabled: boolean
          video_messages_weight: number
          status_posts_enabled: boolean
          status_posts_weight: number
          status_views_enabled: boolean
          status_views_weight: number
          reactions_enabled: boolean
          reactions_weight: number
          min_delay_between_actions: number
          max_delay_between_actions: number
          min_typing_duration: number
          max_typing_duration: number
          max_messages_per_day: number
          max_audio_per_day: number
          max_media_per_day: number
          max_status_per_day: number
          max_reactions_per_day: number
          use_ai_conversations: boolean
          ai_topics: string[] | null
          ai_tone: string
          ai_language: string
          total_actions_executed: number
          total_messages_sent: number
          last_action_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          description?: string | null
          status?: 'active' | 'inactive' | 'paused'
          run_24h?: boolean
          start_time?: string
          end_time?: string
          days_of_week?: number[]
          timezone?: string
          text_messages_enabled?: boolean
          text_messages_weight?: number
          audio_messages_enabled?: boolean
          audio_messages_weight?: number
          image_messages_enabled?: boolean
          image_messages_weight?: number
          document_messages_enabled?: boolean
          document_messages_weight?: number
          video_messages_enabled?: boolean
          video_messages_weight?: number
          status_posts_enabled?: boolean
          status_posts_weight?: number
          status_views_enabled?: boolean
          status_views_weight?: number
          reactions_enabled?: boolean
          reactions_weight?: number
          min_delay_between_actions?: number
          max_delay_between_actions?: number
          min_typing_duration?: number
          max_typing_duration?: number
          max_messages_per_day?: number
          max_audio_per_day?: number
          max_media_per_day?: number
          max_status_per_day?: number
          max_reactions_per_day?: number
          use_ai_conversations?: boolean
          ai_topics?: string[] | null
          ai_tone?: string
          ai_language?: string
          total_actions_executed?: number
          total_messages_sent?: number
          last_action_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          description?: string | null
          status?: 'active' | 'inactive' | 'paused'
          run_24h?: boolean
          start_time?: string
          end_time?: string
          days_of_week?: number[]
          timezone?: string
          text_messages_enabled?: boolean
          text_messages_weight?: number
          audio_messages_enabled?: boolean
          audio_messages_weight?: number
          image_messages_enabled?: boolean
          image_messages_weight?: number
          document_messages_enabled?: boolean
          document_messages_weight?: number
          video_messages_enabled?: boolean
          video_messages_weight?: number
          status_posts_enabled?: boolean
          status_posts_weight?: number
          status_views_enabled?: boolean
          status_views_weight?: number
          reactions_enabled?: boolean
          reactions_weight?: number
          min_delay_between_actions?: number
          max_delay_between_actions?: number
          min_typing_duration?: number
          max_typing_duration?: number
          max_messages_per_day?: number
          max_audio_per_day?: number
          max_media_per_day?: number
          max_status_per_day?: number
          max_reactions_per_day?: number
          use_ai_conversations?: boolean
          ai_topics?: string[] | null
          ai_tone?: string
          ai_language?: string
          total_actions_executed?: number
          total_messages_sent?: number
          last_action_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      warming_config_instances: {
        Row: {
          id: string
          warming_config_id: string
          instance_id: string
          messages_sent_today: number
          audio_sent_today: number
          media_sent_today: number
          status_posted_today: number
          reactions_sent_today: number
          last_action_at: string | null
          counters_reset_date: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          warming_config_id: string
          instance_id: string
          messages_sent_today?: number
          audio_sent_today?: number
          media_sent_today?: number
          status_posted_today?: number
          reactions_sent_today?: number
          last_action_at?: string | null
          counters_reset_date?: string
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          warming_config_id?: string
          instance_id?: string
          messages_sent_today?: number
          audio_sent_today?: number
          media_sent_today?: number
          status_posted_today?: number
          reactions_sent_today?: number
          last_action_at?: string | null
          counters_reset_date?: string
          is_active?: boolean
          created_at?: string
        }
      }
      warming_sessions: {
        Row: {
          id: string
          warming_config_id: string
          tenant_id: string
          status: 'running' | 'paused' | 'completed' | 'failed'
          started_at: string
          paused_at: string | null
          completed_at: string | null
          next_action_at: string | null
          next_action_type: string | null
          actions_executed: number
          errors_count: number
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          warming_config_id: string
          tenant_id: string
          status?: 'running' | 'paused' | 'completed' | 'failed'
          started_at?: string
          paused_at?: string | null
          completed_at?: string | null
          next_action_at?: string | null
          next_action_type?: string | null
          actions_executed?: number
          errors_count?: number
          last_error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          warming_config_id?: string
          tenant_id?: string
          status?: 'running' | 'paused' | 'completed' | 'failed'
          started_at?: string
          paused_at?: string | null
          completed_at?: string | null
          next_action_at?: string | null
          next_action_type?: string | null
          actions_executed?: number
          errors_count?: number
          last_error?: string | null
          created_at?: string
        }
      }
      warming_conversations: {
        Row: {
          id: string
          session_id: string | null
          warming_config_id: string
          initiator_instance_id: string
          receiver_instance_id: string
          status: 'active' | 'completed'
          topic: string | null
          message_count: number
          target_messages: number
          ai_context: Json
          started_at: string
          last_message_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          warming_config_id: string
          initiator_instance_id: string
          receiver_instance_id: string
          status?: 'active' | 'completed'
          topic?: string | null
          message_count?: number
          target_messages?: number
          ai_context?: Json
          started_at?: string
          last_message_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          warming_config_id?: string
          initiator_instance_id?: string
          receiver_instance_id?: string
          status?: 'active' | 'completed'
          topic?: string | null
          message_count?: number
          target_messages?: number
          ai_context?: Json
          started_at?: string
          last_message_at?: string | null
          completed_at?: string | null
        }
      }
      warming_action_logs: {
        Row: {
          id: string
          warming_config_id: string
          session_id: string | null
          conversation_id: string | null
          tenant_id: string
          action_type: string
          from_instance_id: string | null
          to_instance_id: string | null
          content: string | null
          media_url: string | null
          message_id: string | null
          status: 'success' | 'failed' | 'pending'
          error_message: string | null
          ai_generated: boolean
          ai_tokens_used: number | null
          ai_cost_cents: number | null
          executed_at: string
        }
        Insert: {
          id?: string
          warming_config_id: string
          session_id?: string | null
          conversation_id?: string | null
          tenant_id: string
          action_type: string
          from_instance_id?: string | null
          to_instance_id?: string | null
          content?: string | null
          media_url?: string | null
          message_id?: string | null
          status?: 'success' | 'failed' | 'pending'
          error_message?: string | null
          ai_generated?: boolean
          ai_tokens_used?: number | null
          ai_cost_cents?: number | null
          executed_at?: string
        }
        Update: {
          id?: string
          warming_config_id?: string
          session_id?: string | null
          conversation_id?: string | null
          tenant_id?: string
          action_type?: string
          from_instance_id?: string | null
          to_instance_id?: string | null
          content?: string | null
          media_url?: string | null
          message_id?: string | null
          status?: 'success' | 'failed' | 'pending'
          error_message?: string | null
          ai_generated?: boolean
          ai_tokens_used?: number | null
          ai_cost_cents?: number | null
          executed_at?: string
        }
      }
      warming_message_templates: {
        Row: {
          id: string
          tenant_id: string | null
          category: string
          content: string
          language: string
          can_start_conversation: boolean
          can_continue_conversation: boolean
          is_active: boolean
          usage_count: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id?: string | null
          category: string
          content: string
          language?: string
          can_start_conversation?: boolean
          can_continue_conversation?: boolean
          is_active?: boolean
          usage_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string | null
          category?: string
          content?: string
          language?: string
          can_start_conversation?: boolean
          can_continue_conversation?: boolean
          is_active?: boolean
          usage_count?: number
          created_at?: string
        }
      }
      quick_replies: {
        Row: {
          id: string
          tenant_id: string
          name: string
          shortcut: string | null
          category: string | null
          message_type: string
          content: string | null
          media_url: string | null
          media_mimetype: string | null
          file_name: string | null
          usage_count: number
          is_active: boolean
          position: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          shortcut?: string | null
          category?: string | null
          message_type?: string
          content?: string | null
          media_url?: string | null
          media_mimetype?: string | null
          file_name?: string | null
          usage_count?: number
          is_active?: boolean
          position?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          shortcut?: string | null
          category?: string | null
          message_type?: string
          content?: string | null
          media_url?: string | null
          media_mimetype?: string | null
          file_name?: string | null
          usage_count?: number
          is_active?: boolean
          position?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_boards: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          color: string
          position: number
          visibility: 'private' | 'department' | 'team'
          department_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          name: string
          description?: string | null
          color?: string
          position?: number
          visibility?: 'private' | 'department' | 'team'
          department_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          name?: string
          description?: string | null
          color?: string
          position?: number
          visibility?: 'private' | 'department' | 'team'
          department_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_columns: {
        Row: {
          id: string
          board_id: string
          name: string
          color: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          board_id: string
          name: string
          color?: string
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          board_id?: string
          name?: string
          color?: string
          position?: number
          created_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          tenant_id: string
          board_id: string
          column_id: string
          title: string
          description: string | null
          position: number
          assignee_id: string | null
          department_id: string | null
          due_date: string | null
          priority: 'low' | 'medium' | 'high' | 'urgent'
          labels: string[]
          cover_color: string | null
          created_by: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          board_id: string
          column_id: string
          title: string
          description?: string | null
          position?: number
          assignee_id?: string | null
          department_id?: string | null
          due_date?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          labels?: string[]
          cover_color?: string | null
          created_by?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          board_id?: string
          column_id?: string
          title?: string
          description?: string | null
          position?: number
          assignee_id?: string | null
          department_id?: string | null
          due_date?: string | null
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          labels?: string[]
          cover_color?: string | null
          created_by?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      task_checklists: {
        Row: {
          id: string
          task_id: string
          title: string
          is_completed: boolean
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          title: string
          is_completed?: boolean
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          is_completed?: boolean
          position?: number
          created_at?: string
        }
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
