import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
import {
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  FileSearch,
  Files,
  Scale,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";

const Page = styled.main`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  background:
    radial-gradient(circle at 85% 5%, rgba(24, 137, 128, 0.13), transparent 28rem),
    #f4f3ef;
  color: #172234;
  padding: 42px 28px 72px;
`;

const Shell = styled.div`
  width: min(1180px, 100%);
  margin: 0 auto;
`;

const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid rgba(22, 113, 107, 0.22);
  background: rgba(255, 255, 255, 0.72);
  color: #176c67;
  padding: 7px 11px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
`;

const Hero = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 32px;
  align-items: end;
  margin: 24px 0 34px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Title = styled.h1`
  margin: 0;
  max-width: 780px;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: clamp(40px, 6vw, 68px);
  line-height: 0.98;
  letter-spacing: -2.4px;
  font-weight: 500;
`;

const Lead = styled.p`
  max-width: 720px;
  margin: 22px 0 0;
  color: #536174;
  font-size: 17px;
  line-height: 1.75;
`;

const TrustCard = styled.aside`
  border-radius: 18px;
  background: #142538;
  color: #f7f4eb;
  padding: 22px;
  box-shadow: 0 18px 45px rgba(20, 37, 56, 0.16);
`;

const TrustTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 9px;
  font-weight: 800;
  margin-bottom: 12px;
`;

const TrustText = styled.p`
  color: rgba(247, 244, 235, 0.72);
  margin: 0;
  line-height: 1.65;
  font-size: 14px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 24px;
  margin: 38px 0 16px;
`;

const SectionTitle = styled.h2`
  margin: 0;
  font-size: 21px;
  letter-spacing: -0.4px;
`;

const SectionNote = styled.span`
  color: #718094;
  font-size: 13px;
`;

const ToolGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;

  @media (max-width: 1000px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 620px) {
    grid-template-columns: 1fr;
  }
`;

const ToolCard = styled.button`
  min-height: 218px;
  border: 1px solid rgba(23, 34, 52, 0.1);
  border-radius: 16px;
  padding: 20px;
  background: rgba(255, 255, 255, 0.82);
  color: inherit;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;

  &:hover {
    transform: translateY(-3px);
    border-color: rgba(23, 108, 103, 0.35);
    box-shadow: 0 18px 38px rgba(28, 44, 61, 0.1);
  }

  &:focus-visible {
    outline: 3px solid rgba(23, 108, 103, 0.35);
    outline-offset: 3px;
  }
`;

const IconBox = styled.div`
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: #e4efec;
  color: #176c67;
`;

const ToolLabel = styled.div`
  margin-top: 28px;
  font-size: 18px;
  font-weight: 800;
`;

const ToolDescription = styled.p`
  color: #637184;
  font-size: 14px;
  line-height: 1.62;
  margin: 9px 0 20px;
`;

const OpenLink = styled.span`
  margin-top: auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #176c67;
  font-size: 13px;
  font-weight: 800;
`;

const Foundation = styled.section`
  margin-top: 22px;
  display: grid;
  grid-template-columns: 1.25fr 0.75fr;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(23, 34, 52, 0.1);
  border-radius: 18px;
  overflow: hidden;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

const FoundationBody = styled.div`
  padding: 26px;
`;

const FoundationTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 18px;
`;

const FoundationText = styled.p`
  color: #617083;
  line-height: 1.7;
  margin: 0;
`;

const StatusPanel = styled.div`
  background: #e9ece6;
  padding: 26px;
  display: grid;
  gap: 12px;
`;

const StatusRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
`;

const Status = styled.span<{ $ready: boolean }>`
  color: ${(props) => (props.$ready ? "#176c67" : "#8a6731")};
  background: ${(props) =>
    props.$ready ? "rgba(23,108,103,.1)" : "rgba(138,103,49,.1)"};
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 800;
`;

type ActionCard = {
  title: string;
  description: string;
  route: string;
  action: string;
  icon: ReactNode;
};

const actions: ActionCard[] = [
  {
    title: "本地 Codex",
    description: "通过宿主机安全桥接器连接 Codex CLI，复用本机 ChatGPT 登录、工作目录、沙箱和逐项审批。",
    route: "/codex",
    action: "连接执行器",
    icon: <TerminalSquare size={21} />,
  },
  {
    title: "事项与合同",
    description: "建立一个独立事项空间，集中保存合同、补充材料、批注和后续对话。",
    route: "/corpuses",
    action: "进入事项",
    icon: <BriefcaseBusiness size={21} />,
  },
  {
    title: "文档中心",
    description: "上传 PDF、DOCX 或 TXT，查看解析状态并进入原文与证据批注界面。",
    route: "/documents",
    action: "管理文档",
    icon: <Files size={21} />,
  },
  {
    title: "结构化审查",
    description: "使用 OpenContracts Extract 能力批量提取关键事实，为合同审查引擎准备结构化输入。",
    route: "/extracts",
    action: "查看提取任务",
    icon: <FileSearch size={21} />,
  },
  {
    title: "法律知识",
    description: "维护法律法规、内部审查规则和标准模板，所有结论都应回到可定位来源。",
    route: "/corpuses",
    action: "打开知识空间",
    icon: <BookOpenCheck size={21} />,
  },
];

export const LegalDashboard = () => {
  const navigate = useNavigate();

  return (
    <Page>
      <Shell>
        <Eyebrow>
          <Scale size={15} /> 单人私有法务工作台
        </Eyebrow>

        <Hero>
          <div>
            <Title>让每一条法务结论，都能回到原文。</Title>
            <Lead>
              openFaWu 以事项组织上下文，以规则约束审查，以批注保存证据。Agent
              负责检索、提取和起草，最终判断始终由你确认。
            </Lead>
          </div>
          <TrustCard>
            <TrustTitle>
              <ShieldCheck size={19} /> 当前安全边界
            </TrustTitle>
            <TrustText>
              默认本地私有部署；保留账户与对象权限；不自动签署、发送或提交材料；未核验引用不能进入已确认结论。
            </TrustText>
          </TrustCard>
        </Hero>

        <SectionHeader>
          <SectionTitle>开始工作</SectionTitle>
          <SectionNote>第一阶段复用 OpenContracts 的成熟文档能力</SectionNote>
        </SectionHeader>

        <ToolGrid>
          {actions.map((item) => (
            <ToolCard key={item.title} type="button" onClick={() => navigate(item.route)}>
              <IconBox>{item.icon}</IconBox>
              <ToolLabel>{item.title}</ToolLabel>
              <ToolDescription>{item.description}</ToolDescription>
              <OpenLink>
                {item.action} <ArrowRight size={15} />
              </OpenLink>
            </ToolCard>
          ))}
        </ToolGrid>

        <Foundation>
          <FoundationBody>
            <FoundationTitle>
              <ShieldCheck size={19} /> 法务领域基座已建立
            </FoundationTitle>
            <FoundationText>
              数据层已支持事项、版本化审查方案、Playbook 规则、审查运行、风险发现及法律研究任务。
              下一阶段将把这些模型接入 Document Agent、证据核验器和三栏合同审查界面。
            </FoundationText>
          </FoundationBody>
          <StatusPanel>
            <StatusRow>
              文档与引用底座 <Status $ready>已复用</Status>
            </StatusRow>
            <StatusRow>
              单人部署与初始化 <Status $ready>已就绪</Status>
            </StatusRow>
            <StatusRow>
              法务领域数据契约 <Status $ready>已就绪</Status>
            </StatusRow>
            <StatusRow>
              本地 Codex 执行器 <Status $ready>已接入</Status>
            </StatusRow>
            <StatusRow>
              自动合同审查工作流 <Status $ready={false}>持续完善</Status>
            </StatusRow>
          </StatusPanel>
        </Foundation>
      </Shell>
    </Page>
  );
};
