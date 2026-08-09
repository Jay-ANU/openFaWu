import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { useNavigate } from "react-router-dom";
import styled, { css, keyframes } from "styled-components";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  FileText,
  Info,
  LoaderCircle,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { toast } from "react-toastify";

import { importDocumentMultipart } from "../../utils/importHttp";
import {
  CREATE_CONTRACT_REVIEW,
  CreateReviewInput,
  GET_CONTRACT_REVIEW_PROFILES,
  LegalReviewProfile,
  PARTY_POSITION_LABELS,
  ReviewProfilesQueryData,
} from "./reviewApi";

const Page = styled.main`
  min-height: calc(100dvh - var(--oc-navbar-height, 72px));
  padding: 30px 24px 70px;
  background: #f4f3ef;
  color: #172234;

  @media (max-width: 720px) {
    padding: 20px 12px 54px;
  }
`;

const Shell = styled.div`
  width: min(1040px, 100%);
  margin: 0 auto;
`;

const BackButton = styled.button`
  border: 0;
  background: transparent;
  color: #617083;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 6px 0;
  font-weight: 750;
  cursor: pointer;
`;

const Header = styled.header`
  margin: 22px 0 26px;
`;

const Title = styled.h1`
  margin: 0;
  font-family: "Source Serif 4", Georgia, serif;
  font-size: clamp(36px, 5vw, 54px);
  line-height: 1;
  font-weight: 500;
  letter-spacing: -1.7px;
`;

const Lead = styled.p`
  margin: 14px 0 0;
  max-width: 760px;
  color: #69778a;
  line-height: 1.7;
`;

const Form = styled.form`
  display: grid;
  gap: 18px;
`;

const Card = styled.section`
  border: 1px solid rgba(23, 34, 52, 0.1);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 14px 44px rgba(28, 42, 58, 0.06);
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 18px 22px;
  border-bottom: 1px solid rgba(23, 34, 52, 0.08);
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 850;
`;

const CardBody = styled.div`
  padding: 22px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const Field = styled.label`
  display: grid;
  gap: 7px;
  color: #536174;
  font-size: 12px;
  font-weight: 800;
`;

const LabelLine = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
`;

const Optional = styled.span`
  color: #9aa3af;
  font-weight: 600;
`;

const controlCss = css`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(23, 34, 52, 0.16);
  border-radius: 11px;
  padding: 11px 12px;
  background: #fff;
  color: #172234;
  font: inherit;
  font-size: 14px;

  &:focus {
    outline: 3px solid rgba(23, 108, 103, 0.15);
    border-color: #31827d;
  }
`;

const Input = styled.input`
  ${controlCss}
`;

const Select = styled.select`
  ${controlCss}
`;

const Textarea = styled.textarea`
  ${controlCss}
  min-height: 110px;
  resize: vertical;
  line-height: 1.6;
`;

const UploadArea = styled.label<{ $hasFile: boolean }>`
  min-height: 190px;
  border: 1.5px dashed
    ${(props) => (props.$hasFile ? "#31827d" : "rgba(23, 34, 52, 0.22)")};
  border-radius: 15px;
  display: grid;
  place-items: center;
  padding: 26px;
  text-align: center;
  background: ${(props) => (props.$hasFile ? "#f0f7f4" : "#fafaf8")};
  cursor: pointer;

  &:hover {
    border-color: #31827d;
    background: #f4f8f6;
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

const UploadIcon = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  background: #e5efec;
  color: #176c67;
  margin: 0 auto 13px;
`;

const UploadTitle = styled.div`
  font-weight: 850;
`;

const UploadText = styled.div`
  margin-top: 7px;
  color: #7a8798;
  font-size: 12px;
  line-height: 1.55;
`;

const ProfileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
  gap: 12px;
`;

const ProfileCard = styled.button<{ $selected: boolean }>`
  border: 1px solid
    ${(props) => (props.$selected ? "#31827d" : "rgba(23, 34, 52, 0.12)")};
  background: ${(props) => (props.$selected ? "#eef6f3" : "#fff")};
  color: inherit;
  border-radius: 13px;
  padding: 15px;
  text-align: left;
  cursor: pointer;
  min-height: 132px;

  &:hover {
    border-color: #31827d;
  }
`;

const ProfileTitle = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  font-weight: 850;
`;

const ProfileMeta = styled.div`
  margin-top: 8px;
  color: #667588;
  font-size: 12px;
  line-height: 1.55;
`;

const CheckGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const CheckCard = styled.label`
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 13px;
  border: 1px solid rgba(23, 34, 52, 0.1);
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  color: #4f5e72;
  font-size: 13px;
  line-height: 1.5;

  input {
    margin-top: 3px;
    accent-color: #176c67;
  }
`;

const Notice = styled.div`
  border-radius: 12px;
  padding: 13px 14px;
  background: #edf2ef;
  color: #566477;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 12px;
  line-height: 1.6;
`;

const ErrorBox = styled.div`
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff0ef;
  color: #9c3d3d;
  display: flex;
  align-items: flex-start;
  gap: 9px;
  font-size: 13px;
`;

const Footer = styled.div`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
`;

const spin = keyframes`
  to {
    transform: rotate(360deg);
  }
`;

const Spinner = styled(LoaderCircle)`
  animation: ${spin} 900ms linear infinite;
`;

const SubmitButton = styled.button`
  border: 0;
  border-radius: 12px;
  background: #176c67;
  color: #fff;
  padding: 12px 18px;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 14px;
  font-weight: 850;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Progress = styled.div`
  min-width: 180px;
  color: #68778a;
  font-size: 12px;
`;

const ProgressTrack = styled.div`
  height: 5px;
  margin-top: 6px;
  border-radius: 99px;
  background: #dce3df;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $value: number }>`
  width: ${(props) => `${Math.max(0, Math.min(100, props.$value))}%`};
  height: 100%;
  background: #176c67;
  transition: width 180ms ease;
`;

function suggestedTitle(file: File): string {
  return file.name.replace(/\.(pdf|docx|txt)$/i, "");
}

function profileMatchesRole(
  profile: LegalReviewProfile,
  role: string
): boolean {
  return profile.partyPosition === "neutral" || profile.partyPosition === role;
}

export function NewContractReviewPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useQuery<ReviewProfilesQueryData>(
    GET_CONTRACT_REVIEW_PROFILES,
    { variables: { enabledOnly: true }, fetchPolicy: "cache-and-network" }
  );
  const [createReview] = useMutation(CREATE_CONTRACT_REVIEW);

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState("procurement");
  const [partyPosition, setPartyPosition] = useState("buyer");
  const [jurisdiction, setJurisdiction] = useState("CN-MAINLAND");
  const [counterparty, setCounterparty] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [businessContext, setBusinessContext] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [involvesPersonalInformation, setInvolvesPersonalInformation] =
    useState(false);
  const [crossBorderData, setCrossBorderData] = useState(false);
  const [coreIntellectualProperty, setCoreIntellectualProperty] =
    useState(false);
  const [highValueTransaction, setHighValueTransaction] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitError, setSubmitError] = useState("");

  const compatibleProfiles = useMemo(
    () =>
      (data?.legalReviewProfiles ?? []).filter((profile) =>
        profileMatchesRole(profile, partyPosition)
      ),
    [data?.legalReviewProfiles, partyPosition]
  );

  useEffect(() => {
    if (!compatibleProfiles.length) {
      setSelectedProfileId("");
      return;
    }
    if (
      !compatibleProfiles.some((profile) => profile.id === selectedProfileId)
    ) {
      setSelectedProfileId(compatibleProfiles[0].id);
      setContractType(compatibleProfiles[0].contractType || contractType);
      setJurisdiction(compatibleProfiles[0].jurisdiction || jurisdiction);
    }
  }, [compatibleProfiles, selectedProfileId, contractType, jurisdiction]);

  const handleFile = (next: File | null) => {
    setSubmitError("");
    if (!next) {
      setFile(null);
      return;
    }
    if (!/\.(pdf|docx|txt)$/i.test(next.name)) {
      setSubmitError("首版合同审查仅支持 PDF、DOCX 和 TXT 文件。");
      return;
    }
    setFile(next);
    if (!title.trim()) setTitle(suggestedTitle(next));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError("");
    if (!file) {
      setSubmitError("请先上传合同文件。");
      return;
    }
    if (!selectedProfileId) {
      setSubmitError("请选择一套审查规则。");
      return;
    }
    if (!title.trim()) {
      setSubmitError("请填写本次审查名称。");
      return;
    }

    setSubmitting(true);
    setUploadProgress(1);
    try {
      const upload = await importDocumentMultipart({
        file,
        title: title.trim(),
        description: businessContext.trim(),
        filename: file.name,
        makePublic: false,
        customMeta: {
          openfawu_contract_review: true,
          contract_type: contractType,
          party_position: partyPosition,
          jurisdiction,
        },
        onProgress: (fraction) => setUploadProgress(Math.round(fraction * 70)),
      });
      if (!upload.ok) throw new Error(upload.error);
      setUploadProgress(76);

      const variables: { input: CreateReviewInput } = {
        input: {
          documentId: upload.document_id,
          reviewProfileId: Number(selectedProfileId),
          title: title.trim(),
          contractType,
          partyPosition,
          jurisdiction,
          counterparty: counterparty.trim(),
          contractAmount: contractAmount.trim(),
          businessContext: businessContext.trim(),
          involvesPersonalInformation,
          crossBorderData,
          coreIntellectualProperty,
          highValueTransaction,
        },
      };
      const response = await createReview({ variables });
      const payload = response.data?.createContractReview;
      if (!payload?.ok || !payload.reviewRun?.id) {
        throw new Error(payload?.message || "创建合同审查失败。");
      }
      setUploadProgress(100);
      toast.success("合同已进入审查队列");
      navigate(`/reviews/${payload.reviewRun.id}`);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "创建合同审查失败。";
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page>
      <Shell>
        <BackButton type="button" onClick={() => navigate("/reviews")}>
          <ArrowLeft size={17} /> 返回合同审查
        </BackButton>
        <Header>
          <Title>新建合同审查</Title>
          <Lead>
            审查结果取决于合同类型、我方角色与交易背景。先把这些边界说明清楚，
            再由系统执行确定性检查和 Playbook 对照。
          </Lead>
        </Header>

        <Form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <UploadCloud size={19} /> 1. 上传合同
            </CardHeader>
            <CardBody>
              <UploadArea $hasFile={Boolean(file)}>
                <HiddenInput
                  type="file"
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(event) =>
                    handleFile(event.target.files?.[0] ?? null)
                  }
                />
                <div>
                  <UploadIcon>
                    {file ? <FileText size={28} /> : <UploadCloud size={28} />}
                  </UploadIcon>
                  <UploadTitle>
                    {file ? file.name : "点击选择 PDF、DOCX 或 TXT 合同"}
                  </UploadTitle>
                  <UploadText>
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(
                          2
                        )} MB · 文件只会保存到你的私有工作区`
                      : "合同上传后先完成文本解析，再进入逐条审查。扫描版 PDF 的准确率取决于解析质量。"}
                  </UploadText>
                </div>
              </UploadArea>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck size={19} /> 2. 确认审查立场
            </CardHeader>
            <CardBody>
              <Grid>
                <Field>
                  审查名称
                  <Input
                    value={title}
                    maxLength={255}
                    placeholder="例如：XX供应商 SaaS 采购合同"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </Field>
                <Field>
                  合同类型
                  <Select
                    value={contractType}
                    onChange={(event) => setContractType(event.target.value)}
                  >
                    <option value="procurement">采购合同</option>
                    <option value="saas">SaaS / 软件服务</option>
                    <option value="nda">保密协议</option>
                    <option value="service">服务合同</option>
                    <option value="employment">劳动合同</option>
                    <option value="general">其他合同</option>
                  </Select>
                </Field>
                <Field>
                  我方角色
                  <Select
                    value={partyPosition}
                    onChange={(event) => setPartyPosition(event.target.value)}
                  >
                    {Object.entries(PARTY_POSITION_LABELS).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      )
                    )}
                  </Select>
                </Field>
                <Field>
                  司法辖区
                  <Select
                    value={jurisdiction}
                    onChange={(event) => setJurisdiction(event.target.value)}
                  >
                    <option value="CN-MAINLAND">中国大陆</option>
                    <option value="HK">中国香港</option>
                    <option value="SG">新加坡</option>
                    <option value="OTHER">其他 / 待确认</option>
                  </Select>
                </Field>
                <Field>
                  <LabelLine>
                    对方主体 <Optional>可选</Optional>
                  </LabelLine>
                  <Input
                    value={counterparty}
                    placeholder="合同相对方名称"
                    onChange={(event) => setCounterparty(event.target.value)}
                  />
                </Field>
                <Field>
                  <LabelLine>
                    合同金额 <Optional>可选</Optional>
                  </LabelLine>
                  <Input
                    value={contractAmount}
                    placeholder="例如：人民币 300,000 元 / 年"
                    onChange={(event) => setContractAmount(event.target.value)}
                  />
                </Field>
              </Grid>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Check size={19} /> 3. 选择 Playbook
            </CardHeader>
            <CardBody>
              {loading ? (
                <Notice>
                  <LoaderCircle size={17} /> 正在加载审查规则……
                </Notice>
              ) : error ? (
                <ErrorBox>
                  <AlertTriangle size={17} /> 加载审查规则失败：{error.message}
                </ErrorBox>
              ) : compatibleProfiles.length ? (
                <ProfileGrid>
                  {compatibleProfiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      type="button"
                      $selected={selectedProfileId === profile.id}
                      onClick={() => {
                        setSelectedProfileId(profile.id);
                        setContractType(profile.contractType || contractType);
                        setJurisdiction(profile.jurisdiction || jurisdiction);
                      }}
                    >
                      <ProfileTitle>
                        <span>{profile.name}</span>
                        {selectedProfileId === profile.id ? (
                          <Check size={17} color="#176c67" />
                        ) : null}
                      </ProfileTitle>
                      <ProfileMeta>
                        {PARTY_POSITION_LABELS[profile.partyPosition] ??
                          profile.partyPosition}
                        ・{profile.jurisdiction}・{profile.ruleCount} 条规则
                        <br />v{profile.version} ·{" "}
                        {profile.description || "标准合同审查规则"}
                      </ProfileMeta>
                    </ProfileCard>
                  ))}
                </ProfileGrid>
              ) : (
                <ErrorBox>
                  <AlertTriangle size={17} />
                  当前角色没有可用的审查规则。请先在“审查规则”中初始化或启用
                  Playbook。
                </ErrorBox>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <Info size={19} /> 4. 补充交易背景
            </CardHeader>
            <CardBody>
              <Field>
                <LabelLine>
                  业务背景与特殊要求 <Optional>建议填写</Optional>
                </LabelLine>
                <Textarea
                  value={businessContext}
                  placeholder="例如：该服务会处理客户手机号；上线时间不可延期；责任上限最低可接受为合同总金额的 150%；核心算法不得转让。"
                  onChange={(event) => setBusinessContext(event.target.value)}
                />
              </Field>
              <CheckGrid>
                <CheckCard>
                  <input
                    type="checkbox"
                    checked={involvesPersonalInformation}
                    onChange={(event) =>
                      setInvolvesPersonalInformation(event.target.checked)
                    }
                  />
                  <span>合同涉及个人信息处理或用户数据</span>
                </CheckCard>
                <CheckCard>
                  <input
                    type="checkbox"
                    checked={crossBorderData}
                    onChange={(event) =>
                      setCrossBorderData(event.target.checked)
                    }
                  />
                  <span>可能涉及数据出境或境外存储</span>
                </CheckCard>
                <CheckCard>
                  <input
                    type="checkbox"
                    checked={coreIntellectualProperty}
                    onChange={(event) =>
                      setCoreIntellectualProperty(event.target.checked)
                    }
                  />
                  <span>涉及核心知识产权、源代码或商业秘密</span>
                </CheckCard>
                <CheckCard>
                  <input
                    type="checkbox"
                    checked={highValueTransaction}
                    onChange={(event) =>
                      setHighValueTransaction(event.target.checked)
                    }
                  />
                  <span>高金额或对业务连续性影响较大的交易</span>
                </CheckCard>
              </CheckGrid>
              <Notice style={{ marginTop: 14 }}>
                <Info size={17} />
                系统不会把“历史惯例”自动表述成法律强制要求。每个风险会标注其来源，
                并保留需要业务确认的事项。
              </Notice>
            </CardBody>
          </Card>

          {submitError ? (
            <ErrorBox>
              <AlertTriangle size={17} /> {submitError}
            </ErrorBox>
          ) : null}

          <Footer>
            {submitting ? (
              <Progress>
                正在上传并创建审查任务… {uploadProgress}%
                <ProgressTrack>
                  <ProgressFill $value={uploadProgress} />
                </ProgressTrack>
              </Progress>
            ) : null}
            <SubmitButton
              type="submit"
              disabled={submitting || !file || !selectedProfileId}
            >
              {submitting ? <Spinner size={18} /> : <ShieldCheck size={18} />}
              开始合同审查
            </SubmitButton>
          </Footer>
        </Form>
      </Shell>
    </Page>
  );
}
