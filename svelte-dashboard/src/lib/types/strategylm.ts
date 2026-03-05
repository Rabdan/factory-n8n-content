export interface Strategy {
  id: number;
  project_id: number;
  title: string;
  brand_voice: string | null;
  target_audience: string | null;
  core_values: string | null;
  document_markdown?: string | null;
  raw_data_json: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface Campaign {
  id: number;
  strategy_id: number;
  title: string;
  goal: string | null;
  main_message: string | null;
  document_markdown?: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ContentPlan {
  id: number;
  campaign_id: number;
  project_id: number;
  title: string | null;
  platform: string | null;
  schedule_metadata: Record<string, unknown> | null;
  document_markdown?: string | null;
  created_at?: string;
}

export interface Post {
  id: number;
  project_id: number;
  content_plan_id: number | null;
  text_content: string | null;
  status: string | null;
  publish_at: string | null;
}

export interface SourceFile {
  id: number;
  project_id: number;
  strategy_id: number | null;
  campaign_id: number | null;
  content_plan_id?: number | null;
  post_id?: number | null;
  filename: string;
  filepath: string;
  file_type: string | null;
  uploaded_at: string;
}

export interface KnowledgeUrl {
  id: number;
  project_id: number;
  strategy_id: number | null;
  campaign_id: number | null;
  content_plan_id?: number | null;
  post_id?: number | null;
  url: string;
  title: string | null;
  created_at: string;
}

export type NodeType = "strategy" | "campaign" | "plan" | "post";

export interface TreeNode {
  id: number;
  type: NodeType;
  title: string;
  complete: boolean;
  children?: TreeNode[];
  canDelete?: boolean;
  parentStrategyId?: number | null;
  parentCampaignId?: number | null;
  parentPlanId?: number | null;
}
