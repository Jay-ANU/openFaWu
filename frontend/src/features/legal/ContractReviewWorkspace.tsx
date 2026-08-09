import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate, useParams } from "react-router-dom";
import styled from "styled-components";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileCheck2,
  FileText,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "react-toastify";

import {
  COMPLETE_CONTRACT_REVIEW,
  FINDING_STATUS_LABELS,
  FindingReviewStatus,
  GET_CONTRACT_REVIEW_RUN,
  LegalContractFinding,
  LegalReviewRun,
  RESTART_CONTRACT_REVIEW,
  REVIEW_STATUS_LABELS,
  ReviewRunQueryData,
  SEVERITY_LABELS,
  UPDATE_CONTRACT_FINDING,
} from "./reviewApi";

const Page = styled.main`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  background: #eeefeb;
  color: #172234;
`;

const TopBar = styled.header`
  min-height: 72px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.11);
  background: rgba(255, 255, 255, 0.94);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  position: sticky;
  top: var(--oc-navbar-height, 72px);
  z-index: 20;

  @media (max-width: 820px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const HeaderLeft = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const BackButton = styled.button`
  flex: 0 0 auto;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: #617083;
  padding: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;

  &:hover {
    background: #eef1ef;
  }
`;

const HeaderText = styled.div`
  min-width: 0;
`;

const Title = styled.h1`
  margin: 0;
  font-size: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SubTitle = styled.div`
  margin-top: 5px;
  color: #788698;
  font-size: 12px;
  display: flex;
  gap: 8px 12px;
  flex-wrap: wrap;
`;

const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Button = styled.button<{ $primary?: boolean; $danger?: boolean }>`
  border: 1px solid
    ${(props) =>
      props.$danger
        ? "rgba(160, 59, 59, 0.25)"
        : props.$primary
        ? "#176c67"
        : "rgba(23, 34, 52, 0.14)"};
  background: ${(props) =>
    props.$danger ? "#fff3f2" : props.$primary ? "#176c67" : "#fff"};
  color: ${(props) =>
    props.$danger ? "#a03b3b" : props.$primary ? "#fff" : "#445369"};
  border-radius: 9px;
  padding: 8px 11px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 5px 9px;
  font-size: 11px;
  font-weight: 850;
  color: ${(props) =>
    props.$status === "failed"
      ? "#9d3b3b"
      : props.$status === "ready_for_review"
      ? "#8b5823"
      : props.$status === "completed"
      ? "#176c67"
      : "#526174"};
  background: ${(props) =>
    props.$status === "failed"
      ? "#fff0ef"
      : props.$status === "ready_for_review"
      ? "#fff4e4"
      : props.$status === "completed"
      ? "#e8f2ef"
      : "#eef1f3"};
`;

const ProgressBar = styled.div`
  height: 4px;
  background: #d9dedb;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $value: number }>`
  width: ${(props) => `${Math.max(0, Math.min(100, props.$value))}%`};
  height: 100%;
  background: #176c67;
  transition: width 200ms ease;
`;

const Layout = styled.div`
  height: calc(100dvh - var(--oc-navbar-height, 72px) - 76px);
  min-height: 560px;
  display: grid;
  grid-template-columns: 300px minmax(360px, 1fr) 410px;

  @media (max-width: 1180px) {
    grid-template-columns: 260px minmax(330px, 1fr) 360px;
  }

  @media (max-width: 920px) {
    height: auto;
    grid-template-columns: 1fr;
  }
`;

const Pane = styled.section`
  min-width: 0;
  min-height: 0;
  background: #fff;
  border-right: 1px solid rgba(23, 34, 52, 0.09);
  display: flex;
  flex-direction: column;

  &:last-child {
    border-right: 0;
  }

  @media (max-width: 920px) {
    border-right: 0;
    border-bottom: 1px solid rgba(23, 34, 52, 0.09);
    min-height: 420px;
  }
`;

const PaneHeader = styled.div`
  min-height: 58px;
  padding: 0 16px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 850;
`;

const PaneBody = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
`;

const SearchBox = styled.div`
  padding: 12px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.07);
`;

const SearchInputWrap = styled.div`
  position: relative;
`;

const SearchIcon = styled(Search)`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #8995a4;
`;

const Input = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(23, 34, 52, 0.14);
  border-radius: 9px;
  padding: 9px 10px 9px 34px;
  background: #fafaf8;
  color: #172234;
  font: inherit;
  font-size: 12px;

  &:focus {
    outline: 3px solid rgba(23, 108, 103, 0.13);
    border-color: #31827d;
  }
`;

const FilterRow = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 9px;
  overflow-x: auto;
`;

const FilterButton = styled.button<{ $active: boolean }>`
  border: 1px solid
    ${(props) => (props.$active ? "#31827d" : "rgba(23, 34, 52, 0.1)")};
  border-radius: 999px;
  background: ${(props) => (props.$active ? "#edf6f3" : "#fff")};
  color: ${(props) => (props.$active ? "#176c67" : "#68778a")};
  padding: 5px 8px;
  font-size: 10px;
  font-weight: 800;
  white-space: nowrap;
  cursor: pointer;
`;

const ClauseButton = styled.button<{ $selected: boolean; $hasRisk: boolean }>`
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(23, 34, 52, 0.06);
  border-left: 3px solid
    ${(props) => (props.$selected ? "#176c67" : "transparent")};
  background: ${(props) => (props.$selected ? "#edf4f1" : "#fff")};
  color: inherit;
  text-align: left;
  padding: 13px 14px 13px 12px;
  cursor: pointer;

  &:hover {
    background: ${(props) => (props.$selected ? "#edf4f1" : "#f7f8f5")};
  }
`;

const ClauseHeading = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.4;
`;

const RiskCount = styled.span<{ $hasRisk: boolean }>`
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  background: ${(props) => (props.$hasRisk ? "#fff0e7" : "#eef1ef")};
  color: ${(props) => (props.$hasRisk ? "#9a5428" : "#7e8a98")};
  font-size: 10px;
`;

const ClausePreview = styled.div`
  margin-top: 6px;
  color: #8490a0;
  font-size: 10px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const DocumentBody = styled(PaneBody)`
  background: #f1f1ed;
  padding: 24px;

  @media (max-width: 620px) {
    padding: 14px;
  }
`;

const DocumentSheet = styled.article`
  width: min(820px, 100%);
  min-height: calc(100% - 4px);
  margin: 0 auto;
  box-sizing: border-box;
  background: #fff;
  border: 1px solid rgba(23, 34, 52, 0.1);
  box-shadow: 0 12px 34px rgba(28, 42, 58, 0.08);
  padding: 44px 48px;

  @media (max-width: 620px) {
    padding: 28px 22px;
  }
`;

const DocumentHeading = styled.h2`
  margin: 0 0 22px;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 25px;
  line-height: 1.35;
`;

const ClauseText = styled.div`
  white-space: pre-wrap;
  word-break: break-word;
  color: #26364a;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: 16px;
  line-height: 2;
`;

const SourceQuote = styled.blockquote`
  margin: 24px 0 0;
  border-left: 3px solid #d28b52;
  background: #fff8ee;
  padding: 14px 16px;
  color: #6f4b2c;
  white-space: pre-wrap;
  line-height: 1.75;
  font-size: 13px;
`;

const EvidenceNote = styled.div`
  margin-top: 18px;
  border-top: 1px solid rgba(23, 34, 52, 0.08);
  padding-top: 14px;
  color: #8290a0;
  font-size: 11px;
  line-height: 1.6;
`;

const FindingList = styled.div`
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  max-height: 240px;
  overflow: auto;
`;

const FindingTab = styled.button<{ $selected: boolean; $severity: string }>`
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(23, 34, 52, 0.06);
  background: ${(props) => (props.$selected ? "#f5f2ec" : "#fff")};
  color: inherit;
  text-align: left;
  padding: 12px 14px;
  cursor: pointer;

  &:hover {
    background: #f8f7f3;
  }
`;

const FindingTitle = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  font-weight: 850;
  line-height: 1.4;
`;

const Dot = styled.span<{ $severity: string }>`
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  margin-top: 4px;
  border-radius: 50%;
  background: ${(props) =>
    props.$severity === "critical"
      ? "#9e3434"
      : props.$severity === "high"
      ? "#d0693e"
      : props.$severity === "medium"
      ? "#d99c3e"
      : "#4f8b80"};
`;

const FindingMeta = styled.div`
  margin: 5px 0 0 16px;
  color: #8a96a4;
  font-size: 10px;
`;

const DetailBody = styled(PaneBody)`
  padding: 18px;
`;

const SeverityLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
`;

const SeverityBadge = styled.span<{ $severity: string }>`
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 6px 9px;
  font-size: 11px;
  font-weight: 850;
  background: ${(props) =>
    props.$severity === "critical"
      ? "#ffe9e7"
      : props.$severity === "high"
      ? "#fff0e8"
      : props.$severity === "medium"
      ? "#fff7df"
      : "#eaf3f0"};
  color: ${(props) =>
    props.$severity === "critical"
      ? "#963535"
      : props.$severity === "high"
      ? "#9e4e2c"
      : props.$severity === "medium"
      ? "#866122"
      : "#176c67"};
`;

const DetailTitle = styled.h2`
  margin: 0 0 14px;
  font-size: 19px;
  line-height: 1.35;
`;

const Section = styled.section`
  margin-top: 18px;
`;

const SectionLabel = styled.div`
  margin-bottom: 7px;
  color: #738095;
  font-size: 11px;
  font-weight: 850;
  letter-spacing: 0.3px;
`;

const SectionText = styled.div`
  color: #46566a;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
`;

const Textarea = styled.textarea`
  width: 100%;
  min-height: 112px;
  box-sizing: border-box;
  border: 1px solid rgba(23, 34, 52, 0.15);
  border-radius: 10px;
  padding: 11px;
  font: inherit;
  color: #26364a;
  background: #fff;
  resize: vertical;
  line-height: 1.6;

  &:focus {
    outline: 3px solid rgba(23, 108, 103, 0.13);
    border-color: #31827d;
  }
`;

const DecisionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
`;

const DecisionButton = styled.button<{ $selected?: boolean; $kind?: string }>`
  border: 1px solid
    ${(props) => (props.$selected ? "#176c67" : "rgba(23, 34, 52, 0.13)")};
  background: ${(props) => (props.$selected ? "#edf6f3" : "#fff")};
  color: ${(props) => (props.$selected ? "#176c67" : "#46566a")};
  border-radius: 10px;
  padding: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-size: 11px;
  font-weight: 850;
  cursor: pointer;

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
  }
`;

const Empty = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 32px;
  text-align: center;
  color: #7c8999;
  line-height: 1.65;
`;

const LoadingPage = styled.div`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  display: grid;
  place-items: center;
  background: #f4f3ef;
  color: #667588;
`;

const ErrorPanel = styled.div`
  width: min(680px, calc(100% - 32px));
  border: 1px solid rgba(157, 59, 59, 0.18);
  border-radius: 16px;
  background: #fff5f4;
  color: #943d3d;
  padding: 22px;
`;

const Processing = styled.div`
  flex: 1;
  display: grid;
  place-items: center;
  padding: 38px;
  text-align: center;
  color: #677588;
`;

const ProcessingIcon = styled.div`
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  background: #e5efec;
  color: #176c67;
`;

const Count = styled.span`
  color: #8490a0;
  font-size: 11px;
  font-weight: 700;
`;

const Select = styled.select`
  border: 1px solid rgba(23, 34, 52, 0.13);
  border-radius: 8px;
  background: #fff;
  color: #59687b;
  padding: 6px 26px 6px 8px;
  font-size: 11px;
`;

const ACTIVE_STATUSES = new Set([
  "pending",
  "waiting_for_document",
  "parsing",
  "extracting",
  "matching_rules",
  "analyzing",
  "verifying",
]);

const severityOrder: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function decisionIcon(status: FindingReviewStatus) {
  if (status === "accepted" || status === "edited") return <Check size={15} />;
  if (status === "rejected") return <X size={15} />;
  if (status === "needs_follow_up") return <CircleHelp size={15} />;
  return <ShieldAlert size={15} />;
}

function findingMatches(
  finding: LegalContractFinding,
  query: string,
  severity: string,
  status: string
): boolean {
  const haystack =
    `${finding.title} ${finding.riskSummary} ${finding.clauseTitle}`.toLowerCase();
  return (
    (!query || haystack.includes(query.toLowerCase())) &&
    (!severity || finding.severity === severity) &&
    (!status || finding.reviewStatus === status)
  );
}

export function ContractReviewWorkspace() {
  const navigate = useNavigate();
  const { reviewId } = useParams<{ reviewId: string }>();
  const numericId = Number(reviewId);
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    null
  );
  const [query, setQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [replacement, setReplacement] = useState("");
  const [reviewerText, setReviewerText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refetch } = useQuery<ReviewRunQueryData>(
    GET_CONTRACT_REVIEW_RUN,
    {
      variables: { id: numericId },
      skip: !Number.isInteger(numericId) || numericId <= 0,
      fetchPolicy: "cache-and-network",
      pollInterval: 5_000,
    }
  );
  const [updateFinding] = useMutation(UPDATE_CONTRACT_FINDING);
  const [restartReview, { loading: restarting }] = useMutation(
    RESTART_CONTRACT_REVIEW
  );
  const [completeReview, { loading: completing }] = useMutation(
    COMPLETE_CONTRACT_REVIEW
  );

  const review = data?.legalReviewRun ?? null;
  const sortedFindings = useMemo(
    () =>
      [...(review?.findings ?? [])].sort((left, right) => {
        const severityDelta =
          (severityOrder[left.severity] ?? 9) -
          (severityOrder[right.severity] ?? 9);
        return severityDelta || left.sortOrder - right.sortOrder;
      }),
    [review?.findings]
  );
  const filteredFindings = useMemo(
    () =>
      sortedFindings.filter((finding) =>
        findingMatches(finding, query, severityFilter, statusFilter)
      ),
    [sortedFindings, query, severityFilter, statusFilter]
  );

  const selectedFinding =
    sortedFindings.find((finding) => finding.id === selectedFindingId) ??
    filteredFindings[0] ??
    null;
  const selectedClause =
    review?.clauses.find((clause) => clause.id === selectedClauseId) ??
    review?.clauses.find((clause) => clause.id === selectedFinding?.clauseId) ??
    review?.clauses[0] ??
    null;

  useEffect(() => {
    if (!review) return;
    if (!selectedFindingId && review.findings.length) {
      setSelectedFindingId(review.findings[0].id);
    }
    if (!selectedClauseId && review.clauses.length) {
      setSelectedClauseId(review.findings[0]?.clauseId ?? review.clauses[0].id);
    }
  }, [review, selectedFindingId, selectedClauseId]);

  useEffect(() => {
    if (!selectedFinding) {
      setReplacement("");
      setReviewerText("");
      return;
    }
    setReplacement(selectedFinding.suggestedReplacement ?? "");
    setReviewerText(selectedFinding.reviewerText ?? "");
    if (selectedFinding.clauseId) setSelectedClauseId(selectedFinding.clauseId);
  }, [selectedFinding?.id]);

  const selectFinding = (finding: LegalContractFinding) => {
    setSelectedFindingId(finding.id);
    if (finding.clauseId) setSelectedClauseId(finding.clauseId);
  };

  const saveDecision = async (status: FindingReviewStatus) => {
    if (!selectedFinding) return;
    setSaving(true);
    try {
      const response = await updateFinding({
        variables: {
          input: {
            findingId: Number(selectedFinding.id),
            reviewStatus: status,
            reviewerText,
            suggestedReplacement: replacement,
          },
        },
      });
      const payload = response.data?.updateContractFinding;
      if (!payload?.ok) throw new Error(payload?.message || "保存失败");
      toast.success(FINDING_STATUS_LABELS[status]);
      await refetch();
      const currentIndex = filteredFindings.findIndex(
        (finding) => finding.id === selectedFinding.id
      );
      const next = filteredFindings[currentIndex + 1];
      if (next) selectFinding(next);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "保存风险处理结果失败"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRestart = async () => {
    if (!review) return;
    try {
      await restartReview({ variables: { id: Number(review.id) } });
      toast.success("已重新执行合同审查");
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "重新执行失败");
    }
  };

  const handleComplete = async () => {
    if (!review) return;
    try {
      const response = await completeReview({
        variables: { id: Number(review.id) },
      });
      const payload = response.data?.completeContractReview;
      if (!payload?.ok) throw new Error(payload?.message || "完成审查失败");
      toast.success("合同审查已完成");
      await refetch();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "完成审查失败");
    }
  };

  if (loading && !review) {
    return (
      <LoadingPage>
        <div>
          <LoaderCircle size={26} /> 正在加载合同审查……
        </div>
      </LoadingPage>
    );
  }

  if (error || !review) {
    return (
      <LoadingPage>
        <ErrorPanel>
          <strong>无法打开合同审查</strong>
          <p>{error?.message ?? "审查任务不存在或没有访问权限。"}</p>
          <Button type="button" onClick={() => navigate("/reviews")}>
            <ArrowLeft size={15} /> 返回审查列表
          </Button>
        </ErrorPanel>
      </LoadingPage>
    );
  }

  const processing = ACTIVE_STATUSES.has(review.status);
  const canComplete =
    review.status === "ready_for_review" && review.pendingFindings === 0;

  return (
    <Page>
      <TopBar>
        <HeaderLeft>
          <BackButton
            type="button"
            aria-label="返回合同审查列表"
            onClick={() => navigate("/reviews")}
          >
            <ArrowLeft size={19} />
          </BackButton>
          <HeaderText>
            <Title>{review.title}</Title>
            <SubTitle>
              <StatusBadge $status={review.status}>
                {REVIEW_STATUS_LABELS[review.status] ?? review.status}
              </StatusBadge>
              <span>{review.profile.name}</span>
              <span>{review.documentTitle}</span>
              <span>
                {review.totalFindings} 项风险 / {review.pendingFindings}{" "}
                项待处理
              </span>
            </SubTitle>
          </HeaderText>
        </HeaderLeft>
        <HeaderActions>
          {review.documentPdfUrl ? (
            <Button
              type="button"
              onClick={() => window.open(review.documentPdfUrl ?? "", "_blank")}
            >
              <ExternalLink size={15} /> 查看原文件
            </Button>
          ) : null}
          {review.status === "failed" ? (
            <Button type="button" onClick={handleRestart} disabled={restarting}>
              <RotateCcw size={15} /> 重新执行
            </Button>
          ) : null}
          <Button
            type="button"
            $primary
            disabled={!canComplete || completing}
            onClick={handleComplete}
          >
            <FileCheck2 size={15} /> 完成审查
          </Button>
        </HeaderActions>
      </TopBar>
      <ProgressBar>
        <ProgressFill $value={review.progress} />
      </ProgressBar>

      {processing ? (
        <Layout>
          <Pane style={{ gridColumn: "1 / -1" }}>
            <Processing>
              <div>
                <ProcessingIcon>
                  <LoaderCircle size={30} />
                </ProcessingIcon>
                <strong>
                  {REVIEW_STATUS_LABELS[review.status] ?? "正在执行合同审查"}
                </strong>
                <p>
                  {review.summary ||
                    "合同先完成文本解析，再识别条款并执行 Playbook。页面会自动刷新。"}
                </p>
                <Button type="button" onClick={() => void refetch()}>
                  <RefreshCw size={15} /> 立即刷新
                </Button>
              </div>
            </Processing>
          </Pane>
        </Layout>
      ) : review.status === "failed" ? (
        <Layout>
          <Pane style={{ gridColumn: "1 / -1" }}>
            <Processing>
              <div>
                <ProcessingIcon
                  style={{ color: "#a13d3d", background: "#fff0ef" }}
                >
                  <AlertTriangle size={30} />
                </ProcessingIcon>
                <strong>合同审查执行失败</strong>
                <p>{review.errorMessage || "未返回具体错误。"}</p>
                <Button
                  type="button"
                  onClick={handleRestart}
                  disabled={restarting}
                >
                  <RotateCcw size={15} /> 重新执行
                </Button>
              </div>
            </Processing>
          </Pane>
        </Layout>
      ) : (
        <Layout>
          <Pane>
            <PaneHeader>
              <span>条款目录</span>
              <Count>{review.clauses.length} 个条款</Count>
            </PaneHeader>
            <SearchBox>
              <SearchInputWrap>
                <SearchIcon size={14} />
                <Input
                  value={query}
                  placeholder="搜索风险或条款"
                  onChange={(event) => setQuery(event.target.value)}
                />
              </SearchInputWrap>
              <FilterRow>
                {["", "critical", "high", "medium", "low"].map((value) => (
                  <FilterButton
                    key={value || "all"}
                    type="button"
                    $active={severityFilter === value}
                    onClick={() => setSeverityFilter(value)}
                  >
                    {value ? SEVERITY_LABELS[value] ?? value : "全部风险"}
                  </FilterButton>
                ))}
              </FilterRow>
            </SearchBox>
            <PaneBody>
              {review.clauses.map((clause) => (
                <ClauseButton
                  key={clause.id}
                  type="button"
                  $selected={selectedClause?.id === clause.id}
                  $hasRisk={clause.riskCount > 0}
                  onClick={() => {
                    setSelectedClauseId(clause.id);
                    const firstRisk = filteredFindings.find(
                      (finding) => finding.clauseId === clause.id
                    );
                    if (firstRisk) setSelectedFindingId(firstRisk.id);
                  }}
                >
                  <ClauseHeading>
                    <span>{clause.heading}</span>
                    <RiskCount $hasRisk={clause.riskCount > 0}>
                      {clause.riskCount}
                    </RiskCount>
                  </ClauseHeading>
                  <ClausePreview>{clause.text}</ClausePreview>
                </ClauseButton>
              ))}
            </PaneBody>
          </Pane>

          <Pane>
            <PaneHeader>
              <span>{selectedClause?.heading ?? "合同原文"}</span>
              <Count>{selectedClause?.clauseType ?? ""}</Count>
            </PaneHeader>
            <DocumentBody>
              <DocumentSheet>
                {selectedClause ? (
                  <>
                    <DocumentHeading>{selectedClause.heading}</DocumentHeading>
                    <ClauseText>{selectedClause.text}</ClauseText>
                    {selectedFinding?.sourceQuote ? (
                      <SourceQuote>{selectedFinding.sourceQuote}</SourceQuote>
                    ) : null}
                    <EvidenceNote>
                      文本位置：{selectedClause.sourceStart}–
                      {selectedClause.sourceEnd}
                      {selectedClause.confidence != null
                        ? ` · 条款识别置信度 ${(
                            selectedClause.confidence * 100
                          ).toFixed(0)}%`
                        : ""}
                      <br />
                      首版使用文本偏移进行证据绑定；PDF
                      页码与可视化高亮将在后续接入 OpenContracts Annotation。
                    </EvidenceNote>
                  </>
                ) : (
                  <Empty>未识别到合同条款。</Empty>
                )}
              </DocumentSheet>
            </DocumentBody>
          </Pane>

          <Pane>
            <PaneHeader>
              <span>风险与修改意见</span>
              <Select
                aria-label="风险处理状态筛选"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">全部状态</option>
                {Object.entries(FINDING_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </PaneHeader>
            <FindingList>
              {filteredFindings.map((finding) => (
                <FindingTab
                  key={finding.id}
                  type="button"
                  $selected={selectedFinding?.id === finding.id}
                  $severity={finding.severity}
                  onClick={() => selectFinding(finding)}
                >
                  <FindingTitle>
                    <Dot $severity={finding.severity} />
                    <span>{finding.title}</span>
                  </FindingTitle>
                  <FindingMeta>
                    {SEVERITY_LABELS[finding.severity] ?? finding.severity} ·{" "}
                    {finding.clauseTitle}
                    {finding.reviewStatus !== "pending"
                      ? ` · ${FINDING_STATUS_LABELS[finding.reviewStatus]}`
                      : ""}
                  </FindingMeta>
                </FindingTab>
              ))}
              {!filteredFindings.length ? (
                <Empty>当前筛选条件下没有风险项。</Empty>
              ) : null}
            </FindingList>

            {selectedFinding ? (
              <DetailBody>
                <SeverityLine>
                  <SeverityBadge $severity={selectedFinding.severity}>
                    {SEVERITY_LABELS[selectedFinding.severity] ??
                      selectedFinding.severity}
                    {selectedFinding.blocking ? " · 阻断项" : ""}
                  </SeverityBadge>
                  <StatusBadge $status={selectedFinding.reviewStatus}>
                    {FINDING_STATUS_LABELS[selectedFinding.reviewStatus]}
                  </StatusBadge>
                </SeverityLine>
                <DetailTitle>{selectedFinding.title}</DetailTitle>

                <Section>
                  <SectionLabel>风险说明</SectionLabel>
                  <SectionText>{selectedFinding.riskSummary}</SectionText>
                </Section>
                {selectedFinding.businessImpact ? (
                  <Section>
                    <SectionLabel>标准立场 / 业务影响</SectionLabel>
                    <SectionText>{selectedFinding.businessImpact}</SectionText>
                  </Section>
                ) : null}
                {selectedFinding.recommendedAction ? (
                  <Section>
                    <SectionLabel>推荐处理</SectionLabel>
                    <SectionText>
                      {selectedFinding.recommendedAction}
                    </SectionText>
                  </Section>
                ) : null}
                <Section>
                  <SectionLabel>建议修改文本</SectionLabel>
                  <Textarea
                    value={replacement}
                    placeholder="填写可直接进入合同的替换条款"
                    onChange={(event) => setReplacement(event.target.value)}
                  />
                </Section>
                {selectedFinding.fallbackPosition ? (
                  <Section>
                    <SectionLabel>谈判退让方案</SectionLabel>
                    <SectionText>
                      {selectedFinding.fallbackPosition}
                    </SectionText>
                  </Section>
                ) : null}
                {selectedFinding.requiredConfirmation ? (
                  <Section>
                    <SectionLabel>需要业务确认</SectionLabel>
                    <SectionText>
                      {selectedFinding.requiredConfirmation}
                    </SectionText>
                  </Section>
                ) : null}
                <Section>
                  <SectionLabel>复核备注</SectionLabel>
                  <Textarea
                    value={reviewerText}
                    placeholder="记录接受原文、修改或待确认的原因"
                    onChange={(event) => setReviewerText(event.target.value)}
                  />
                </Section>

                <DecisionGrid>
                  {(
                    [
                      "accepted",
                      "edited",
                      "rejected",
                      "needs_follow_up",
                    ] as FindingReviewStatus[]
                  ).map((status) => (
                    <DecisionButton
                      key={status}
                      type="button"
                      $selected={selectedFinding.reviewStatus === status}
                      disabled={saving || review.status === "completed"}
                      onClick={() => void saveDecision(status)}
                    >
                      {decisionIcon(status)} {FINDING_STATUS_LABELS[status]}
                    </DecisionButton>
                  ))}
                </DecisionGrid>
              </DetailBody>
            ) : (
              <Empty>
                <div>
                  <FileText size={28} />
                  <p>选择一个风险项查看依据和修改建议。</p>
                </div>
              </Empty>
            )}
          </Pane>
        </Layout>
      )}
    </Page>
  );
}
