/** أنواع ردود الـ API (مطابقة لـ backend/app/schemas.py و routers). */

export type Category = "methodology" | "shubuhat" | "intro_islam" | "new_muslim";
export type PostStatus = "draft" | "review" | "published";
export type ContentType = "article" | "booklet" | "leaflet" | "shubha_response";
export type Lang = "ar" | "en";
export type IndexState = "indexed" | "stale" | "pending";
export type HealthState = "ok" | "warning" | "down";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor";
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Section {
  id: number;
  parent_id: number | null;
  name_ar: string;
  name_en: string | null;
  slug: string;
  category: Category;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  posts_count: number;
}

export interface PostListItem {
  id: number;
  section_id: number;
  slug: string;
  title_ar: string;
  title_en: string | null;
  summary_ar: string | null;
  tags: string[];
  topic: string | null;
  source_name: string | null;
  content_type: ContentType;
  status: PostStatus;
  published_at: string | null;
  updated_at: string;
  indexed_at: string | null;
}

export interface PostPage {
  items: PostListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface Post extends PostListItem {
  content_ar: string;
  content_en: string | null;
  external_ref: string | null;
  file_url: string | null;
  created_by: number | null;
  reviewed_by: number | null;
  review_note?: string | null;
  created_by_name?: string | null;
  reviewed_by_name?: string | null;
}

export interface PostWithIndex extends Post {
  indexed: boolean;
  chunks: number | null;
  index_warning: string | null;
  note_saved?: boolean;
}

export interface DashboardStats {
  sections: number;
  sections_active: number;
  posts_total: number;
  posts_by_status: Record<PostStatus, number>;
  posts_indexed: number;
  chunks: number;
  questions_today: number;
  fallback_today: number;
  fallback_rate_today: number;
  questions_total: number;
  fallback_rate_total: number;
  referral_centers: number;
  unanswered_questions: number;
}

export interface SystemStatusItem {
  key: "database" | "gemini" | "index" | "agent";
  label: string;
  state: HealthState;
  detail: string;
  latency_ms?: number;
}

export interface SystemStatus {
  overall: HealthState;
  checked_at: string;
  items: SystemStatusItem[];
  chat_models: string[];
  embedding_model: string;
}

export type ActivityType =
  | "post_published"
  | "index_updated"
  | "post_saved"
  | "post_review"
  | "settings_updated";

export interface ActivityEvent {
  type: ActivityType;
  at: string;
  post_id?: number;
  title?: string;
  version?: number;
}

export interface UserRef {
  id: number;
  name: string;
}

export interface AISettings {
  id: number;
  guidance_prompt: string;
  similarity_threshold: number;
  top_k: number;
  fallback_message_ar: string;
  fallback_message_en: string;
  version: number;
  is_active: boolean;
  updated_by: number | null;
  updated_at: string | null;
  updated_by_user: UserRef | null;
  chat_models: string[];
  embedding_model: string;
}

export interface AISettingsHistory {
  id: number;
  version: number;
  guidance_prompt: string;
  similarity_threshold: number;
  top_k: number;
  fallback_message_ar: string;
  fallback_message_en: string;
  updated_by: number | null;
  saved_at: string;
  updated_by_user: UserRef | null;
}

export interface IndexStatusItem {
  post_id: number;
  slug: string;
  title_ar: string;
  state: IndexState;
  chunks_ar: number;
  chunks_en: number;
  indexed_at: string | null;
  updated_at: string;
}

export interface IndexStatus {
  total_posts: number;
  published: number;
  indexed: number;
  stale: number;
  pending: number;
  total_chunks: number;
  orphan_chunk_posts: number;
  last_indexed_at: string | null;
  embedding_model: string;
  embedding_dim: number;
  items: IndexStatusItem[];
}

export interface ReindexResult {
  indexed: number;
  failed: { post_id: number; error: string }[];
  chunks: number;
  unindexed: number;
  total_published: number;
}

export interface SourceBrief {
  post_id: number;
  slug: string;
  title: string;
  section: string | null;
  similarity: number;
}

export interface ReferralCenter {
  id: number;
  name: string;
  country: string | null;
  url: string | null;
  contact: string | null;
}

export interface MatchedPost {
  id: number;
  slug: string;
  title: string;
  section: string | null;
  content: string;
  lang: Lang;
  lang_fallback: boolean;
  summary: string | null;
  source_name: string | null;
  external_ref: string | null;
  file_url: string | null;
  content_type: ContentType | null;
}

export type AgentResponse =
  | {
      type: "match";
      guidance: string;
      post: MatchedPost;
      related: SourceBrief[];
      sources: SourceBrief[];
    }
  | {
      type: "fallback";
      message: string;
      closest: SourceBrief | null;
      referrals: ReferralCenter[];
    };

export interface LabResult {
  classification: { category: Category | "unknown"; lang: Lang; source?: string; model?: string | null };
  requested_lang: Lang;
  threshold: number;
  top_k: number;
  top_score: number | null;
  decision: "match" | "fallback";
  results: (SourceBrief & { above_threshold: boolean; chunk_lang: Lang; best_chunk: string })[];
  guidance_source: string | null;
  guidance_model: string | null;
  settings_version: number;
  preview: AgentResponse;
}

export interface UnansweredGroup {
  question: string;
  count: number;
  last_at: string;
  category: Category | null;
  lang: Lang | null;
  closest: { id: number; slug: string; title_ar: string; similarity: number | null } | null;
}

/* ============ الموقع العام (/api/*) ============ */
export interface SectionRef {
  name_ar: string;
  name_en: string | null;
  slug: string;
  category: Category;
}

export interface PublicSection {
  id: number;
  parent_id: number | null;
  name_ar: string;
  name_en: string | null;
  slug: string;
  category: Category;
  description: string | null;
  sort_order: number;
  posts_count: number;
}

export interface PublicPostCard {
  id: number;
  slug: string;
  title_ar: string;
  title_en: string | null;
  summary_ar: string | null;
  excerpt: string;
  excerpt_en: string | null;
  tags: string[];
  topic: string | null;
  content_type: ContentType;
  file_url: string | null;
  source_name: string | null;
  published_at: string | null;
  has_en: boolean;
  reading_minutes: number;
  reading_minutes_en: number | null;
  section: SectionRef | null;
}

export interface PublicPostPage {
  items: PublicPostCard[];
  total: number;
  page: number;
  page_size: number;
}

export interface PublicPost {
  id: number;
  slug: string;
  section_id: number;
  title_ar: string;
  title_en: string | null;
  content_ar: string;
  content_en: string | null;
  summary_ar: string | null;
  tags: string[];
  external_ref: string | null;
  topic: string | null;
  source_name: string | null;
  content_type: ContentType;
  file_url: string | null;
  published_at: string | null;
  updated_at: string;
  reading_minutes: number;
  reading_minutes_en: number | null;
  section: SectionRef;
}

export interface PublicCategoryCount {
  category: Category;
  posts_count: number;
  sections_count: number;
}

export interface PublicTopic {
  topic: string;
  posts_count: number;
}

/** رد POST /api/chat (نفس AgentResponse + العتبة + log_id، وفي البدائل المصادر أيضاً). */
export type ChatResponse = AgentResponse & { threshold: number; log_id: number; sources?: SourceBrief[] };

/* ---------- استيراد المحتوى ---------- */
export interface ImportRow {
  index: number;
  source_id: string | null;
  slug: string | null;
  title_ar: string | null;
  title_en: string | null;
  category: Category | null;
  section_id: number | null;
  section_name: string | null;
  content_type: string | null;
  topic: string | null;
  tags: string[];
  has_en: boolean;
  content_chars: number;
  errors: string[];
  warnings: string[];
  created_id: number | null;
}

export interface ImportResult {
  dry_run: boolean;
  status: "draft" | "review";
  total: number;
  valid: number;
  invalid: number;
  created: number;
  rows: ImportRow[];
}

export interface DailyQuestions {
  days: number;
  tz_offset: number;
  total: number;
  fallback: number;
  fallback_rate: number | null;
  items: { date: string; questions: number; fallback: number; answered: number; fallback_rate: number | null }[];
}
