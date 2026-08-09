import { gql } from "@apollo/client";

export type ReviewRunStatus =
  | "pending"
  | "waiting_for_document"
  | "parsing"
  | "extracting"
  | "matching_rules"
  | "analyzing"
  | "verifying"
  | "ready_for_review"
  | "completed"
  | "failed"
  | "cancelled";

export type FindingReviewStatus =
  | "pending"
  | "accepted"
  | "edited"
  | "rejected"
  | "needs_follow_up";

export interface LegalPlaybookRule {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  requiredTerms: string[];
  prohibitedTerms: string[];
  requiredTermsMode: string;
  applicability: Record<string, unknown>;
  standardPosition: string;
  fallbackPosition: string;
  suggestedLanguage: string;
  legalBasisDescription: string;
  businessQuestion: string;
  blocking: boolean;
  sortOrder: number;
}

export interface LegalReviewProfile {
  id: string;
  name: string;
  contractType: string;
  partyPosition: string;
  jurisdiction: string;
  description: string;
  version: number;
  enabled: boolean;
  ruleCount: number;
  rules: LegalPlaybookRule[];
}

export interface LegalContractClause {
  id: string;
  clauseType: string;
  heading: string;
  text: string;
  sourceStart: number;
  sourceEnd: number;
  pageNumber: number | null;
  sortOrder: number;
  confidence: number | null;
  riskCount: number;
}

export interface LegalContractFinding {
  id: string;
  category: string;
  title: string;
  riskType: string;
  clauseId: string | null;
  clauseTitle: string;
  severity: string;
  riskSummary: string;
  sourceQuote: string;
  sourceStart: number | null;
  sourceEnd: number | null;
  pageNumber: number | null;
  playbookRuleId: string | null;
  businessImpact: string;
  recommendedAction: string;
  suggestedReplacement: string;
  fallbackPosition: string;
  requiredConfirmation: string;
  confidence: number | null;
  verificationStatus: string;
  reviewStatus: FindingReviewStatus;
  reviewerText: string;
  sortOrder: number;
  blocking: boolean;
}

export interface LegalReviewRunSummary {
  id: string;
  title: string;
  status: ReviewRunStatus;
  currentStage: string;
  progress: number;
  summary: string;
  errorMessage: string;
  inputContext: Record<string, unknown>;
  documentId: string;
  documentTitle: string;
  documentProcessingStatus: string;
  profile: LegalReviewProfile;
  totalFindings: number;
  pendingFindings: number;
  criticalFindings: number;
  highFindings: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface LegalReviewRun extends LegalReviewRunSummary {
  extractedContractData: Record<string, unknown>;
  documentSlug: string | null;
  documentPdfUrl: string | null;
  documentTextUrl: string | null;
  clauses: LegalContractClause[];
  findings: LegalContractFinding[];
}

export interface LegalReviewDashboard {
  total: number;
  active: number;
  waitingForReview: number;
  completed: number;
  highRiskPending: number;
}

export interface ReviewRunsQueryData {
  legalReviewDashboard: LegalReviewDashboard;
  legalReviewRuns: LegalReviewRunSummary[];
}

export interface ReviewProfilesQueryData {
  legalReviewProfiles: LegalReviewProfile[];
}

export interface ReviewRunQueryData {
  legalReviewRun: LegalReviewRun | null;
}

export interface CreateReviewInput {
  documentId: number;
  reviewProfileId: number;
  title: string;
  contractType: string;
  partyPosition: string;
  jurisdiction: string;
  counterparty: string;
  contractAmount: string;
  businessContext: string;
  involvesPersonalInformation: boolean;
  crossBorderData: boolean;
  coreIntellectualProperty: boolean;
  highValueTransaction: boolean;
}

const PROFILE_FIELDS = gql`
  fragment LegalReviewProfileFields on LegalReviewProfileType {
    id
    name
    contractType
    partyPosition
    jurisdiction
    description
    version
    enabled
    ruleCount
    rules {
      id
      category
      title
      description
      severity
      requiredTerms
      prohibitedTerms
      requiredTermsMode
      applicability
      standardPosition
      fallbackPosition
      suggestedLanguage
      legalBasisDescription
      businessQuestion
      blocking
      sortOrder
    }
  }
`;

const REVIEW_SUMMARY_FIELDS = gql`
  ${PROFILE_FIELDS}
  fragment LegalReviewSummaryFields on LegalReviewRunType {
    id
    title
    status
    currentStage
    progress
    summary
    errorMessage
    inputContext
    documentId
    documentTitle
    documentProcessingStatus
    profile {
      ...LegalReviewProfileFields
    }
    totalFindings
    pendingFindings
    criticalFindings
    highFindings
    createdAt
    updatedAt
    startedAt
    completedAt
  }
`;

export const GET_CONTRACT_REVIEW_DASHBOARD = gql`
  ${REVIEW_SUMMARY_FIELDS}
  query GetContractReviewDashboard($limit: Int!) {
    legalReviewDashboard {
      total
      active
      waitingForReview
      completed
      highRiskPending
    }
    legalReviewRuns(limit: $limit) {
      ...LegalReviewSummaryFields
    }
  }
`;

export const GET_CONTRACT_REVIEW_PROFILES = gql`
  ${PROFILE_FIELDS}
  query GetContractReviewProfiles($enabledOnly: Boolean!) {
    legalReviewProfiles(enabledOnly: $enabledOnly) {
      ...LegalReviewProfileFields
    }
  }
`;

export const GET_CONTRACT_REVIEW_RUN = gql`
  ${REVIEW_SUMMARY_FIELDS}
  query GetContractReviewRun($id: Int!) {
    legalReviewRun(id: $id) {
      ...LegalReviewSummaryFields
      extractedContractData
      documentSlug
      documentPdfUrl
      documentTextUrl
      clauses {
        id
        clauseType
        heading
        text
        sourceStart
        sourceEnd
        pageNumber
        sortOrder
        confidence
        riskCount
      }
      findings {
        id
        category
        title
        riskType
        clauseId
        clauseTitle
        severity
        riskSummary
        sourceQuote
        sourceStart
        sourceEnd
        pageNumber
        playbookRuleId
        businessImpact
        recommendedAction
        suggestedReplacement
        fallbackPosition
        requiredConfirmation
        confidence
        verificationStatus
        reviewStatus
        reviewerText
        sortOrder
        blocking
      }
    }
  }
`;

export const CREATE_CONTRACT_REVIEW = gql`
  ${REVIEW_SUMMARY_FIELDS}
  mutation CreateContractReview($input: CreateContractReviewInput!) {
    createContractReview(input: $input) {
      ok
      message
      reviewRun {
        ...LegalReviewSummaryFields
      }
    }
  }
`;

export const UPDATE_CONTRACT_FINDING = gql`
  mutation UpdateContractFinding($input: UpdateContractFindingInput!) {
    updateContractFinding(input: $input) {
      ok
      message
      finding {
        id
        reviewStatus
        reviewerText
        suggestedReplacement
      }
    }
  }
`;

export const RESTART_CONTRACT_REVIEW = gql`
  mutation RestartContractReview($id: Int!) {
    restartContractReview(id: $id) {
      ok
      message
      reviewRun {
        id
        status
        currentStage
        progress
        errorMessage
      }
    }
  }
`;

export const COMPLETE_CONTRACT_REVIEW = gql`
  mutation CompleteContractReview($id: Int!) {
    completeContractReview(id: $id) {
      ok
      message
      reviewRun {
        id
        status
        completedAt
      }
    }
  }
`;

export const REVIEW_STATUS_LABELS: Record<ReviewRunStatus, string> = {
  pending: "等待执行",
  waiting_for_document: "等待文档解析",
  parsing: "识别合同结构",
  extracting: "提取合同事实",
  matching_rules: "匹配审查规则",
  analyzing: "分析条款风险",
  verifying: "核验证据",
  ready_for_review: "等待人工复核",
  completed: "审查完成",
  failed: "执行失败",
  cancelled: "已取消",
};

export const FINDING_STATUS_LABELS: Record<FindingReviewStatus, string> = {
  pending: "待复核",
  accepted: "接受修改",
  edited: "编辑后接受",
  rejected: "接受原文",
  needs_follow_up: "待业务确认",
};

export const PARTY_POSITION_LABELS: Record<string, string> = {
  buyer: "采购方",
  seller: "供应方",
  employer: "用人单位",
  employee: "劳动者",
  discloser: "披露方",
  recipient: "接收方",
  neutral: "中立审查",
};

export const SEVERITY_LABELS: Record<string, string> = {
  critical: "严重",
  high: "高风险",
  medium: "中风险",
  low: "低风险",
  info: "提示",
};
