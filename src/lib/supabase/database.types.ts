
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {

  "public": {
          Tables: {
            "availability_days": {
                  Row: {
                    "group_id": string,"id": string,"local_date": string,"membership_id": string,"mode": string | null,"revision": number,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"local_date": string,"membership_id": string,"mode"?: string | null,"revision"?: number,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"local_date"?: string,"membership_id"?: string,"mode"?: string | null,"revision"?: number,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_days_group_id_membership_id_fkey"
      columns: ["group_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"availability_intervals": {
                  Row: {
                    "day_id": string,"ends_at": string,"group_id": string,"id": string,"membership_id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day_id": string,"ends_at": string,"group_id": string,"id"?: string,"membership_id": string,"starts_at": string
                  }
                  Update: {
                    "day_id"?: string,"ends_at"?: string,"group_id"?: string,"id"?: string,"membership_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "availability_intervals_group_id_membership_id_day_id_fkey"
      columns: ["group_id","membership_id","day_id"]
isOneToOne: false
      referencedRelation: "availability_days"
      referencedColumns: ["group_id","membership_id","id"]
    }
                  ]
                },"game_favorites": {
                  Row: {
                    "game_id": string,"group_id": string,"membership_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "game_id": string,"group_id": string,"membership_id": string
                  }
                  Update: {
                    "game_id"?: string,"group_id"?: string,"membership_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "game_favorites_group_id_game_id_fkey"
      columns: ["group_id","game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "game_favorites_group_id_membership_id_fkey"
      columns: ["group_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"games": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string,"description": string,"group_id": string,"id": string,"idempotency_key": string,"name": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by": string,"description"?: string,"group_id": string,"id"?: string,"idempotency_key": string,"name": string,"revision"?: number
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string,"group_id"?: string,"id"?: string,"idempotency_key"?: string,"name"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "games_group_id_created_by_fkey"
      columns: ["group_id","created_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "games_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "id": string,"name": string,"quick_end": string,"quick_start": string,"revision": number,"singleton": boolean,"timezone": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name"?: string,"quick_end"?: string,"quick_start"?: string,"revision"?: number,"singleton"?: boolean,"timezone"?: string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"quick_end"?: string,"quick_start"?: string,"revision"?: number,"singleton"?: boolean,"timezone"?: string
                  }
                  Relationships: [

                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"auth_user_id": string | null,"created_at": string,"delivery_status": string,"expires_at": string,"group_id": string,"id": string,"idempotency_key": string,"invited_by": string,"normalized_email": string,"provisioning_status": string,"revision": number,"status": string,"terminal_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"delivery_status"?: string,"expires_at"?: string,"group_id": string,"id"?: string,"idempotency_key": string,"invited_by": string,"normalized_email": string,"provisioning_status"?: string,"revision"?: number,"status"?: string,"terminal_at"?: string | null
                  }
                  Update: {
                    "accepted_at"?: string | null,"auth_user_id"?: string | null,"created_at"?: string,"delivery_status"?: string,"expires_at"?: string,"group_id"?: string,"id"?: string,"idempotency_key"?: string,"invited_by"?: string,"normalized_email"?: string,"provisioning_status"?: string,"revision"?: number,"status"?: string,"terminal_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "group_id": string,"id": string,"joined_at": string,"participation_epoch": number,"revision": number,"revoked_at": string | null,"role": string,"status": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"joined_at"?: string,"participation_epoch"?: number,"revision"?: number,"revoked_at"?: string | null,"role"?: string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"joined_at"?: string,"participation_epoch"?: number,"revision"?: number,"revoked_at"?: string | null,"role"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"notification_preferences": {
                  Row: {
                    "membership_id": string,"push_enabled": boolean,"reminders_enabled": boolean,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "membership_id": string,"push_enabled"?: boolean,"reminders_enabled"?: boolean,"revision"?: number
                  }
                  Update: {
                    "membership_id"?: string,"push_enabled"?: boolean,"reminders_enabled"?: boolean,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: true
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"event_key": string,"expires_at": string,"id": string,"membership_epoch": number,"membership_id": string,"payload": NonNullable<Json>,"read_at": string | null,"resource_id": string,"revision": number,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_key": string,"expires_at": string,"id"?: string,"membership_epoch": number,"membership_id": string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"resource_id": string,"revision"?: number,"type": string
                  }
                  Update: {
                    "created_at"?: string,"event_key"?: string,"expires_at"?: string,"id"?: string,"membership_epoch"?: number,"membership_id"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"resource_id"?: string,"revision"?: number,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "display_name": string,"revision": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "display_name": string,"revision"?: number,"user_id": string
                  }
                  Update: {
                    "display_name"?: string,"revision"?: number,"user_id"?: string
                  }
                  Relationships: [

                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": string,"membership_id": string,"p256dh": string,"revision": number
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: string,"membership_id": string,"p256dh": string,"revision"?: number
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: string,"membership_id"?: string,"p256dh"?: string,"revision"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_subscriptions_membership_id_fkey"
      columns: ["membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["id"]
    }
                  ]
                },"session_ballots": {
                  Row: {
                    "group_id": string,"id": string,"membership_id": string,"revision": number,"session_id": string,"submitted_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"id"?: string,"membership_id": string,"revision"?: number,"session_id": string,"submitted_at"?: string
                  }
                  Update: {
                    "group_id"?: string,"id"?: string,"membership_id"?: string,"revision"?: number,"session_id"?: string,"submitted_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ballots_parent"
      columns: ["group_id","session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "session_ballots_group_id_membership_id_fkey"
      columns: ["group_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"session_rsvps": {
                  Row: {
                    "group_id": string,"membership_epoch": number,"membership_id": string,"response": string,"revision": number,"session_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "group_id": string,"membership_epoch": number,"membership_id": string,"response": string,"revision"?: number,"session_id": string,"updated_at"?: string
                  }
                  Update: {
                    "group_id"?: string,"membership_epoch"?: number,"membership_id"?: string,"response"?: string,"revision"?: number,"session_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rsvps_parent"
      columns: ["group_id","session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "session_rsvps_group_id_membership_id_fkey"
      columns: ["group_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"session_slots": {
                  Row: {
                    "ends_at": string,"group_id": string,"id": string,"session_id": string,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ends_at": string,"group_id": string,"id"?: string,"session_id": string,"starts_at": string
                  }
                  Update: {
                    "ends_at"?: string,"group_id"?: string,"id"?: string,"session_id"?: string,"starts_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_slots_parent"
      columns: ["group_id","session_id"]
isOneToOne: false
      referencedRelation: "sessions"
      referencedColumns: ["group_id","id"]
    }
                  ]
                },"session_votes": {
                  Row: {
                    "ballot_id": string,"group_id": string,"session_id": string,"slot_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ballot_id": string,"group_id": string,"session_id": string,"slot_id": string
                  }
                  Update: {
                    "ballot_id"?: string,"group_id"?: string,"session_id"?: string,"slot_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "session_votes_group_id_session_id_slot_id_fkey"
      columns: ["group_id","session_id","slot_id"]
isOneToOne: false
      referencedRelation: "session_slots"
      referencedColumns: ["group_id","session_id","id"]
    },{
      foreignKeyName: "votes_ballot"
      columns: ["group_id","session_id","ballot_id"]
isOneToOne: false
      referencedRelation: "session_ballots"
      referencedColumns: ["group_id","session_id","id"]
    }
                  ]
                },"sessions": {
                  Row: {
                    "confirmed_slot_id": string | null,"created_at": string,"created_by": string,"description": string,"game_id": string | null,"group_id": string,"id": string,"idempotency_key": string,"minimum_players": number,"published_at": string | null,"revision": number,"status": string,"terminal_at": string | null,"title": string,"updated_at": string,"vote_deadline": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confirmed_slot_id"?: string | null,"created_at"?: string,"created_by": string,"description"?: string,"game_id"?: string | null,"group_id": string,"id"?: string,"idempotency_key": string,"minimum_players"?: number,"published_at"?: string | null,"revision"?: number,"status"?: string,"terminal_at"?: string | null,"title": string,"updated_at"?: string,"vote_deadline"?: string | null
                  }
                  Update: {
                    "confirmed_slot_id"?: string | null,"created_at"?: string,"created_by"?: string,"description"?: string,"game_id"?: string | null,"group_id"?: string,"id"?: string,"idempotency_key"?: string,"minimum_players"?: number,"published_at"?: string | null,"revision"?: number,"status"?: string,"terminal_at"?: string | null,"title"?: string,"updated_at"?: string,"vote_deadline"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "sessions_confirmed_slot"
      columns: ["group_id","id","confirmed_slot_id"]
isOneToOne: false
      referencedRelation: "session_slots"
      referencedColumns: ["group_id","session_id","id"]
    },{
      foreignKeyName: "sessions_group_id_created_by_fkey"
      columns: ["group_id","created_by"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["group_id","id"]
    },{
      foreignKeyName: "sessions_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "sessions_group_id_game_id_fkey"
      columns: ["group_id","game_id"]
isOneToOne: false
      referencedRelation: "games"
      referencedColumns: ["group_id","id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitation":
{ Args: { "display_name": string }; Returns: string
                           },
"advance_sessions":
{ Args: { "batch_size"?: number }; Returns: number
                           },
"archive_game":
{ Args: { "expected_revision": number,"target_id": string }; Returns: undefined
                           },
"begin_notification_job":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"bootstrap_admin":
{ Args: { "account_id": string,"display_name": string }; Returns: undefined
                           },
"change_membership":
{ Args: { "expected_revision": number,"membership_id": string,"new_role": string,"new_status": string }; Returns: undefined
                           },
"claim_notification_deliveries":
{ Args: { "batch_size"?: number }; Returns: {
              "id": string,"lease_token": string
            }[]
                           },
"consume_auth_limit":
{ Args: { "key_hash": string,"max_attempts": number }; Returns: boolean
                           },
"create_game":
{ Args: { "game_description": string,"game_name": string,"request_id": string }; Returns: string
                           },
"create_invitation":
{ Args: { "email": string,"request_id": string }; Returns: string
                           },
"create_session":
{ Args: { "candidate_slots": Json,"deadline": string,"player_threshold": number,"request_id": string,"selected_game": string,"session_description": string,"session_title": string }; Returns: string
                           },
"enqueue_availability_reminders":
{ Args: { "reference_time"?: string }; Returns: number
                           },
"finish_notification_delivery":
{ Args: { "delivery_id": string,"error_code"?: string,"outcome": string,"retry_seconds"?: number,"token": string }; Returns: boolean
                           },
"finish_notification_job":
{ Args: { "counts": Json,"job_id": string,"success": boolean }; Returns: undefined
                           },
"materialize_notifications":
{ Args: { "batch_size"?: number,"reference_time"?: string }; Returns: number
                           },
"notification_command":
{ Args: { "command": string,"expected_revision": number,"payload": Json }; Returns: string
                           },
"notification_job_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"prepare_notification_delivery":
{ Args: { "delivery_id": string,"reference_time"?: string,"token": string }; Returns: Json
                           },
"provisioning_context":
{ Args: { "actor_id": string,"invitation_id": string }; Returns: Json
                           },
"purge_retained_data":
{ Args: { "batch_size"?: number,"reference_time"?: string }; Returns: Json
                           },
"read_confirmed_commitments":
{ Args: { "member_ids": (string)[],"period_end": string,"period_start": string }; Returns: {
              "ends_at": string,"membership_id": string,"starts_at": string
            }[]
                           },
"record_invitation_delivery":
{ Args: { "actor_id": string,"delivered": boolean,"invitation_id": string }; Returns: undefined
                           },
"revoke_invitation":
{ Args: { "expected_revision": number,"invitation_id": string }; Returns: undefined
                           },
"save_availability":
{ Args: { "changes": Json,"sources"?: Json }; Returns: undefined
                           },
"session_clock":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"session_command":
{ Args: { "command": string,"expected_revision": number,"payload"?: Json,"target_id": string }; Returns: undefined
                           },
"set_game_favorite":
{ Args: { "expected_favorite": boolean,"favorite": boolean,"target_id": string }; Returns: undefined
                           },
"update_game":
{ Args: { "expected_revision": number,"game_description": string,"game_name": string,"target_id": string }; Returns: undefined
                           },
"update_profile":
{ Args: { "display_name": string,"expected_revision": number }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {

          }
        }
} as const
