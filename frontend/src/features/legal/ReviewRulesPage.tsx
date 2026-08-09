import { useMemo, useState } from "react";
import { useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Scale,
  ShieldAlert,
} from "lucide-react";

import {
  GET_CONTRACT_REVIEW_PROFILES,
  LegalPlaybookRule,
  PARTY_POSITION_LABELS,
  ReviewProfilesQueryData,
  SEVERITY_LABELS,
} from "./reviewApi";

const Page = styled.main`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  padding: 30px 24px 70px;
  background: #f4f3ef;
  color: #172234;

  @media (max-width: 720px) {
    padding: 20px 12px 52px;
  }
`;

const Shell = styled.div`
  width: min(1120px, 100%);
  margin: 0 auto;
`;

const Back = styled.button`
  border: 0;
  background: transparent;
  color: #617083;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 0;
  font-weight: 750;
  cursor: pointer;
`;

const Header = styled.header`
  margin: 22px 0 25px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: clamp(36px, 5vw, 54px);
  font-weight: 500;
  line-height: 1;
  letter-spacing: -1.7px;
`;

const Lead = styled.p`
  margin: 14px 0 0;
  max-width: 760px;
  color: #69778a;
  line-height: 1.7;
`;

const ProfileCard = styled.section`
  border: 1px solid rgba(23, 34, 52, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 40px rgba(28, 42, 58, 0.05);
  overflow: hidden;
  margin-bottom: 16px;
`;

const ProfileHeader = styled.div`
  padding: 20px 22px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;

  @media (max-width: 620px) {
    flex-direction: column;
  }
`;

const ProfileTitle = styled.h2`
  margin: 0;
  font-size: 18px;
`;

const ProfileMeta = styled.div`
  margin-top: 7px;
  color: #718094;
  font-size: 12px;
  line-height: 1.6;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 9px;
  border-radius: 999px;
  background: #e9f2ef;
  color: #176c67;
  font-size: 11px;
  font-weight: 850;
  white-space: nowrap;
`;

const RuleList = styled.div`
  display: grid;
`;

const RuleButton = styled.button`
  width: 100%;
  border: 0;
  border-bottom: 1px solid rgba(23, 34, 52, 0.07);
  background: transparent;
  color: inherit;
  padding: 15px 20px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: #f8f8f5;
  }
`;

const Dot = styled.span<{ $severity: string }>`
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: ${(props) =>
    props.$severity === "critical"
      ? "#9e3434"
      : props.$severity === "high"
      ? "#cf683e"
      : props.$severity === "medium"
      ? "#d39b3f"
      : "#4d8d80"};
`;

const RuleName = styled.div`
  font-size: 13px;
  font-weight: 850;
`;

const RuleMeta = styled.div`
  margin-top: 5px;
  color: #8490a0;
  font-size: 11px;
`;

const RuleDetail = styled.div`
  padding: 19px 22px 22px 43px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.07);
  background: #f7f7f3;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    padding-left: 20px;
  }
`;

const DetailBlock = styled.div`
  min-width: 0;
`;

const DetailLabel = styled.div`
  margin-bottom: 6px;
  color: #738095;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.3px;
`;

const DetailText = styled.div`
  color: #46566a;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
`;

const TermList = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

const Term = styled.span<{ $danger?: boolean }>`
  border-radius: 999px;
  padding: 4px 7px;
  background: ${(props) => (props.$danger ? "#fff0e9" : "#eaf2ef")};
  color: ${(props) => (props.$danger ? "#9b522d" : "#176c67")};
  font-size: 10px;
  font-weight: 750;
`;

const Empty = styled.div`
  border: 1px solid rgba(23, 34, 52, 0.1);
  border-radius: 16px;
  background: #fff;
  padding: 36px;
  text-align: center;
  color: #748195;
`;

const Error = styled.div`
  border-radius: 12px;
  background: #fff0ef;
  color: #993d3d;
  padding: 13px 14px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
`;

function RuleRow({ rule }: { rule: LegalPlaybookRule }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RuleButton type="button" onClick={() => setOpen((value) => !value)}>
        <Dot $severity={rule.severity} />
        <div>
          <RuleName>{rule.title}</RuleName>
          <RuleMeta>
            {SEVERITY_LABELS[rule.severity] ?? rule.severity} · {rule.category}
            {rule.blocking ? " · 阻断项" : ""}
          </RuleMeta>
        </div>
        {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
      </RuleButton>
      {open ? (
        <RuleDetail>
          <DetailBlock>
            <DetailLabel>审查说明</DetailLabel>
            <DetailText>{rule.description || "未填写"}</DetailText>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>标准立场</DetailLabel>
            <DetailText>{rule.standardPosition || "未填写"}</DetailText>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>建议修改文本</DetailLabel>
            <DetailText>{rule.suggestedLanguage || "未填写"}</DetailText>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>谈判退让方案</DetailLabel>
            <DetailText>{rule.fallbackPosition || "未填写"}</DetailText>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>需要业务确认</DetailLabel>
            <DetailText>{rule.businessQuestion || "无"}</DetailText>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>法律或内部依据</DetailLabel>
            <DetailText>{rule.legalBasisDescription || "未配置"}</DetailText>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>必须出现</DetailLabel>
            <TermList>
              {rule.requiredTerms.length ? (
                rule.requiredTerms.map((term) => <Term key={term}>{term}</Term>)
              ) : (
                <DetailText>无</DetailText>
              )}
            </TermList>
          </DetailBlock>
          <DetailBlock>
            <DetailLabel>禁止或重点限制</DetailLabel>
            <TermList>
              {rule.prohibitedTerms.length ? (
                rule.prohibitedTerms.map((term) => (
                  <Term key={term} $danger>
                    {term}
                  </Term>
                ))
              ) : (
                <DetailText>无</DetailText>
              )}
            </TermList>
          </DetailBlock>
        </RuleDetail>
      ) : null}
    </>
  );
}

export function ReviewRulesPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<ReviewProfilesQueryData>(
    GET_CONTRACT_REVIEW_PROFILES,
    { variables: { enabledOnly: false }, fetchPolicy: "cache-and-network" }
  );
  const profiles = useMemo(
    () => data?.legalReviewProfiles ?? [],
    [data?.legalReviewProfiles]
  );

  return (
    <Page>
      <Shell>
        <Back type="button" onClick={() => navigate("/reviews")}>
          <ArrowLeft size={17} /> 返回合同审查
        </Back>
        <Header>
          <Title>合同审查规则</Title>
          <Lead>
            Playbook 是产品的核心。每条规则明确标准立场、最低可接受方案、
            建议条款、风险等级以及需要业务确认的问题，而不是依赖通用法律问答。
          </Lead>
        </Header>

        {error ? (
          <Error>
            <AlertTriangle size={17} /> 加载审查规则失败：{error.message}
          </Error>
        ) : null}

        {!loading && !profiles.length ? (
          <Empty>
            <Scale size={30} />
            <p>
              尚未初始化审查规则。执行单人初始化命令后会生成默认采购方
              Playbook。
            </p>
          </Empty>
        ) : null}

        {profiles.map((profile) => (
          <ProfileCard key={profile.id}>
            <ProfileHeader>
              <div>
                <ProfileTitle>{profile.name}</ProfileTitle>
                <ProfileMeta>
                  {PARTY_POSITION_LABELS[profile.partyPosition] ??
                    profile.partyPosition}
                  ・{profile.contractType}・{profile.jurisdiction}・v
                  {profile.version}
                  <br />
                  {profile.description || "未填写说明"}
                </ProfileMeta>
              </div>
              <Badge>
                {profile.enabled ? (
                  <CheckCircle2 size={14} />
                ) : (
                  <ShieldAlert size={14} />
                )}
                {profile.enabled ? `${profile.ruleCount} 条启用规则` : "已停用"}
              </Badge>
            </ProfileHeader>
            <RuleList>
              {profile.rules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} />
              ))}
              {!profile.rules.length ? (
                <Empty>
                  <CircleHelp size={26} />
                  <p>这套 Playbook 尚未配置规则。</p>
                </Empty>
              ) : null}
            </RuleList>
          </ProfileCard>
        ))}
      </Shell>
    </Page>
  );
}
