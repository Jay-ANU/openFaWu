import { useMemo } from "react";
import { useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FilePlus2,
  FileSearch,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import {
  GET_CONTRACT_REVIEW_DASHBOARD,
  REVIEW_STATUS_LABELS,
  ReviewRunsQueryData,
  LegalReviewRunSummary,
} from "./reviewApi";

const Page = styled.main`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  padding: 34px 28px 70px;
  background: radial-gradient(
      circle at 88% 3%,
      rgba(30, 120, 112, 0.11),
      transparent 30rem
    ),
    #f4f3ef;
  color: #172234;

  @media (max-width: 720px) {
    padding: 24px 14px 54px;
  }
`;

const Shell = styled.div`
  width: min(1240px, 100%);
  margin: 0 auto;
`;

const Hero = styled.section`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 28px;

  @media (max-width: 760px) {
    align-items: flex-start;
    flex-direction: column;
  }
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #176c67;
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 10px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: clamp(38px, 5vw, 62px);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -2px;
`;

const Lead = styled.p`
  max-width: 760px;
  margin: 16px 0 0;
  color: #617083;
  font-size: 16px;
  line-height: 1.7;
`;

const PrimaryButton = styled.button`
  border: 0;
  border-radius: 12px;
  background: #176c67;
  color: #fff;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 26px rgba(23, 108, 103, 0.18);
  white-space: nowrap;

  &:hover {
    background: #125d59;
  }

  &:focus-visible {
    outline: 3px solid rgba(23, 108, 103, 0.28);
    outline-offset: 3px;
  }
`;

const Metrics = styled.section`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 26px;

  @media (max-width: 960px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  @media (max-width: 620px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const Metric = styled.div<{ $attention?: boolean }>`
  min-height: 102px;
  border-radius: 15px;
  border: 1px solid
    ${(props) =>
      props.$attention ? "rgba(166, 91, 42, 0.25)" : "rgba(23, 34, 52, 0.1)"};
  background: ${(props) =>
    props.$attention
      ? "rgba(255, 248, 238, 0.9)"
      : "rgba(255, 255, 255, 0.82)"};
  padding: 16px;
`;

const MetricLabel = styled.div`
  color: #718094;
  font-size: 12px;
  font-weight: 800;
`;

const MetricValue = styled.div`
  margin-top: 9px;
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -1px;
`;

const Grid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 18px;
  align-items: start;

  @media (max-width: 960px) {
    grid-template-columns: 1fr;
  }
`;

const Panel = styled.section`
  border: 1px solid rgba(23, 34, 52, 0.1);
  background: rgba(255, 255, 255, 0.84);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: 0 14px 42px rgba(28, 42, 58, 0.06);
`;

const PanelHeader = styled.div`
  min-height: 62px;
  padding: 0 20px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 17px;
  display: flex;
  align-items: center;
  gap: 9px;
`;

const QuietButton = styled.button`
  border: 0;
  background: transparent;
  color: #5f6f82;
  padding: 7px;
  border-radius: 8px;
  cursor: pointer;
  display: inline-grid;
  place-items: center;

  &:hover {
    background: rgba(23, 34, 52, 0.06);
  }
`;

const ReviewRow = styled.button`
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(23, 34, 52, 0.07);
  background: transparent;
  color: inherit;
  text-align: left;
  padding: 18px 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  cursor: pointer;

  &:last-child {
    border-bottom: 0;
  }

  &:hover {
    background: rgba(235, 241, 237, 0.65);
  }

  &:focus-visible {
    outline: 3px solid rgba(23, 108, 103, 0.25);
    outline-offset: -3px;
  }
`;

const ReviewName = styled.div`
  font-weight: 850;
  line-height: 1.35;
`;

const Meta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px 12px;
  flex-wrap: wrap;
  margin-top: 8px;
  color: #748195;
  font-size: 12px;
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

const RiskSummary = styled.div`
  min-width: 92px;
  text-align: right;
`;

const RiskNumber = styled.div<{ $attention: boolean }>`
  font-size: 18px;
  font-weight: 850;
  color: ${(props) => (props.$attention ? "#a24f37" : "#526174")};
`;

const RiskLabel = styled.div`
  margin-top: 4px;
  color: #8a95a3;
  font-size: 11px;
`;

const Empty = styled.div`
  min-height: 270px;
  display: grid;
  place-items: center;
  padding: 34px;
  text-align: center;
  color: #718094;
`;

const EmptyIcon = styled.div`
  width: 58px;
  height: 58px;
  display: grid;
  place-items: center;
  margin: 0 auto 14px;
  border-radius: 16px;
  background: #e7efec;
  color: #176c67;
`;

const SideBody = styled.div`
  padding: 18px;
  display: grid;
  gap: 12px;
`;

const ActionCard = styled.button`
  width: 100%;
  border: 1px solid rgba(23, 34, 52, 0.1);
  background: #fff;
  border-radius: 13px;
  padding: 15px;
  color: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    border-color: rgba(23, 108, 103, 0.35);
    background: #fbfcfa;
  }
`;

const ActionTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 850;
`;

const ActionText = styled.p`
  margin: 8px 0 0;
  color: #718094;
  font-size: 12px;
  line-height: 1.55;
`;

const ErrorBox = styled.div`
  margin-bottom: 18px;
  border-radius: 12px;
  background: #fff0ef;
  color: #993d3d;
  padding: 12px 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
`;

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function ReviewItem({
  review,
  onOpen,
}: {
  review: LegalReviewRunSummary;
  onOpen: () => void;
}) {
  const attention = review.criticalFindings + review.highFindings > 0;
  return (
    <ReviewRow type="button" onClick={onOpen}>
      <div>
        <ReviewName>{review.title || review.documentTitle}</ReviewName>
        <Meta>
          <StatusBadge $status={review.status}>
            {REVIEW_STATUS_LABELS[review.status] ?? review.status}
          </StatusBadge>
          <span>{review.profile.name}</span>
          <span>{review.documentTitle}</span>
          <span>{formatDate(review.updatedAt)}</span>
        </Meta>
      </div>
      <RiskSummary>
        <RiskNumber $attention={attention}>{review.pendingFindings}</RiskNumber>
        <RiskLabel>待处理风险</RiskLabel>
      </RiskSummary>
    </ReviewRow>
  );
}

export function ContractReviewDashboard() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useQuery<ReviewRunsQueryData>(
    GET_CONTRACT_REVIEW_DASHBOARD,
    {
      variables: { limit: 50 },
      fetchPolicy: "cache-and-network",
      pollInterval: 15_000,
    }
  );

  const sortedReviews = useMemo(
    () =>
      [...(data?.legalReviewRuns ?? [])].sort((left, right) => {
        const leftReady = left.status === "ready_for_review" ? 1 : 0;
        const rightReady = right.status === "ready_for_review" ? 1 : 0;
        if (leftReady !== rightReady) return rightReady - leftReady;
        return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
      }),
    [data?.legalReviewRuns]
  );

  const dashboard = data?.legalReviewDashboard;

  return (
    <Page>
      <Shell>
        <Hero>
          <div>
            <Eyebrow>
              <ClipboardCheck size={16} /> 合同审查工作台
            </Eyebrow>
            <Title>逐条发现风险，直接形成修改稿</Title>
            <Lead>
              上传合同并选择我方立场。系统按审查规则识别条款、生成替换文本，
              你只需要逐项接受、编辑、接受原文或交由业务确认。
            </Lead>
          </div>
          <PrimaryButton type="button" onClick={() => navigate("/reviews/new")}>
            <FilePlus2 size={18} /> 新建合同审查
          </PrimaryButton>
        </Hero>

        {error ? (
          <ErrorBox>
            <AlertTriangle size={17} />
            <span>加载合同审查数据失败：{error.message}</span>
          </ErrorBox>
        ) : null}

        <Metrics aria-label="合同审查概览">
          <Metric>
            <MetricLabel>全部审查</MetricLabel>
            <MetricValue>{dashboard?.total ?? (loading ? "—" : 0)}</MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>执行中</MetricLabel>
            <MetricValue>
              {dashboard?.active ?? (loading ? "—" : 0)}
            </MetricValue>
          </Metric>
          <Metric $attention={(dashboard?.waitingForReview ?? 0) > 0}>
            <MetricLabel>待人工复核</MetricLabel>
            <MetricValue>
              {dashboard?.waitingForReview ?? (loading ? "—" : 0)}
            </MetricValue>
          </Metric>
          <Metric $attention={(dashboard?.highRiskPending ?? 0) > 0}>
            <MetricLabel>高风险待处理</MetricLabel>
            <MetricValue>
              {dashboard?.highRiskPending ?? (loading ? "—" : 0)}
            </MetricValue>
          </Metric>
          <Metric>
            <MetricLabel>已完成</MetricLabel>
            <MetricValue>
              {dashboard?.completed ?? (loading ? "—" : 0)}
            </MetricValue>
          </Metric>
        </Metrics>

        <Grid>
          <Panel>
            <PanelHeader>
              <PanelTitle>
                <FileSearch size={18} /> 最近审查
              </PanelTitle>
              <QuietButton
                type="button"
                aria-label="刷新合同审查列表"
                onClick={() => void refetch()}
              >
                <RefreshCw size={17} />
              </QuietButton>
            </PanelHeader>
            {sortedReviews.length > 0 ? (
              sortedReviews.map((review) => (
                <ReviewItem
                  key={review.id}
                  review={review}
                  onOpen={() => navigate(`/reviews/${review.id}`)}
                />
              ))
            ) : (
              <Empty>
                <div>
                  <EmptyIcon>
                    <FileSearch size={28} />
                  </EmptyIcon>
                  <strong>还没有合同审查任务</strong>
                  <div>
                    先上传一份 PDF、DOCX 或 TXT 合同，建立第一套审查结果。
                  </div>
                </div>
              </Empty>
            )}
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>
                <ShieldCheck size={18} /> 常用操作
              </PanelTitle>
            </PanelHeader>
            <SideBody>
              <ActionCard
                type="button"
                onClick={() => navigate("/reviews/new")}
              >
                <ActionTitle>
                  <FilePlus2 size={18} /> 新建审查 <ChevronRight size={16} />
                </ActionTitle>
                <ActionText>
                  上传合同、选择我方角色与 Playbook，并补充交易背景。
                </ActionText>
              </ActionCard>
              <ActionCard
                type="button"
                onClick={() => navigate("/review-rules")}
              >
                <ActionTitle>
                  <Settings2 size={18} /> 审查规则 <ChevronRight size={16} />
                </ActionTitle>
                <ActionText>
                  查看标准立场、退让方案、风险等级和业务确认问题。
                </ActionText>
              </ActionCard>
              <ActionCard type="button" onClick={() => navigate("/documents")}>
                <ActionTitle>
                  <CheckCircle2 size={18} /> 合同文档 <ChevronRight size={16} />
                </ActionTitle>
                <ActionText>
                  管理已上传合同、解析状态和原始文档版本。
                </ActionText>
              </ActionCard>
              <ActionCard type="button" onClick={() => navigate("/codex")}>
                <ActionTitle>
                  <Settings2 size={18} /> 高级运行时 <ArrowRight size={16} />
                </ActionTitle>
                <ActionText>
                  本地 Codex 已降级为调试与高级执行入口，不参与日常操作导航。
                </ActionText>
              </ActionCard>
            </SideBody>
          </Panel>
        </Grid>
      </Shell>
    </Page>
  );
}
