import { useState, useEffect, useRef } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { ChevronRight, AlertTriangle, CheckCircle, XCircle, Info, TrendingUp, Shield, DollarSign, Briefcase } from "lucide-react";

type EmploymentType = "full-time" | "part-time" | "self-employed" | "unemployed" | "retired";
type LoanPurpose = "home" | "auto" | "personal" | "business" | "education" | "debt-consolidation";

interface FormData {
  annualIncome: string;
  creditScore: string;
  loanAmount: string;
  loanTermMonths: string;
  employmentType: EmploymentType;
  loanPurpose: LoanPurpose;
  existingDebt: string;
  monthsEmployed: string;
}

interface RiskFactor {
  label: string;
  score: number;
  weight: number;
  status: "good" | "fair" | "poor";
  detail: string;
}

interface PredictionResult {
  approvalProbability: number;
  verdict: "approved" | "conditional" | "rejected";
  monthlyPayment: number;
  dti: number;
  riskFactors: RiskFactor[];
  recommendations: string[];
}

const INITIAL_FORM: FormData = {
  annualIncome: "",
  creditScore: "",
  loanAmount: "",
  loanTermMonths: "60",
  employmentType: "full-time",
  loanPurpose: "personal",
  existingDebt: "",
  monthsEmployed: "",
};

function computeMonthlyPayment(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1);
}

function estimateInterestRate(creditScore: number, purpose: LoanPurpose): number {
  const base =
    creditScore >= 800 ? 0.045
    : creditScore >= 740 ? 0.065
    : creditScore >= 670 ? 0.09
    : creditScore >= 580 ? 0.14
    : 0.22;
  const purposeAdj: Record<LoanPurpose, number> = {
    home: -0.01, auto: -0.005, personal: 0, business: 0.01,
    education: -0.005, "debt-consolidation": 0.005,
  };
  return Math.max(0.03, base + purposeAdj[purpose]);
}

function predict(form: FormData): PredictionResult {
  const income = parseFloat(form.annualIncome) || 0;
  const credit = parseInt(form.creditScore) || 0;
  const loan = parseFloat(form.loanAmount) || 0;
  const months = parseInt(form.loanTermMonths) || 60;
  const debt = parseFloat(form.existingDebt) || 0;
  const employed = parseInt(form.monthsEmployed) || 0;

  const rate = estimateInterestRate(credit, form.loanPurpose);
  const monthly = computeMonthlyPayment(loan, rate, months);
  const monthlyIncome = income / 12;
  const dti = monthlyIncome > 0 ? ((monthly + debt / 12) / monthlyIncome) * 100 : 100;

  // Credit score factor (0–100)
  const creditScore =
    credit >= 800 ? 100
    : credit >= 740 ? 85
    : credit >= 670 ? 65
    : credit >= 580 ? 40
    : credit >= 500 ? 20
    : 5;

  // DTI factor
  const dtiScore =
    dti <= 20 ? 100
    : dti <= 28 ? 85
    : dti <= 36 ? 65
    : dti <= 43 ? 40
    : dti <= 50 ? 20
    : 5;

  // Loan-to-income ratio
  const lti = income > 0 ? loan / income : 999;
  const ltiScore =
    lti <= 1 ? 100
    : lti <= 2.5 ? 85
    : lti <= 4 ? 65
    : lti <= 6 ? 40
    : 15;

  // Employment factor
  const empBase: Record<EmploymentType, number> = {
    "full-time": 90, retired: 80, "self-employed": 65, "part-time": 50, unemployed: 5,
  };
  const employmentStability = empBase[form.employmentType];
  const tenureBonus = Math.min(20, employed / 6);
  const employmentScore = Math.min(100, employmentStability + (form.employmentType !== "unemployed" ? tenureBonus : 0));

  // Weighted aggregate
  const weights = { credit: 0.35, dti: 0.30, lti: 0.20, employment: 0.15 };
  const rawProb =
    creditScore * weights.credit +
    dtiScore * weights.dti +
    ltiScore * weights.lti +
    employmentScore * weights.employment;

  const approvalProbability = Math.round(Math.min(98, Math.max(2, rawProb)));

  const verdict =
    approvalProbability >= 70 ? "approved"
    : approvalProbability >= 45 ? "conditional"
    : "rejected";

  const riskFactors: RiskFactor[] = [
    {
      label: "Credit Score",
      score: creditScore,
      weight: 35,
      status: creditScore >= 70 ? "good" : creditScore >= 40 ? "fair" : "poor",
      detail:
        credit >= 740 ? `${credit} — Excellent credit history`
        : credit >= 670 ? `${credit} — Good standing`
        : credit >= 580 ? `${credit} — Fair, some risk`
        : `${credit} — Below threshold`,
    },
    {
      label: "Debt-to-Income",
      score: dtiScore,
      weight: 30,
      status: dtiScore >= 70 ? "good" : dtiScore >= 40 ? "fair" : "poor",
      detail:
        dti <= 28 ? `${dti.toFixed(1)}% — Within safe range`
        : dti <= 43 ? `${dti.toFixed(1)}% — Approaching limit`
        : `${dti.toFixed(1)}% — Exceeds recommended 43%`,
    },
    {
      label: "Loan-to-Income Ratio",
      score: ltiScore,
      weight: 20,
      status: ltiScore >= 70 ? "good" : ltiScore >= 40 ? "fair" : "poor",
      detail:
        lti <= 2.5 ? `${lti.toFixed(1)}× income — Conservative`
        : lti <= 4 ? `${lti.toFixed(1)}× income — Manageable`
        : `${lti.toFixed(1)}× income — High leverage`,
    },
    {
      label: "Employment Stability",
      score: employmentScore,
      weight: 15,
      status: employmentScore >= 70 ? "good" : employmentScore >= 40 ? "fair" : "poor",
      detail:
        form.employmentType === "full-time" ? `Full-time · ${employed} months tenure`
        : form.employmentType === "retired" ? "Retired — stable income assumed"
        : form.employmentType === "self-employed" ? `Self-employed · ${employed} months`
        : form.employmentType === "part-time" ? `Part-time · ${employed} months`
        : "No active employment",
    },
  ];

  const recommendations: string[] = [];
  if (credit < 670) recommendations.push("Improve your credit score by paying bills on time and reducing credit card balances.");
  if (dti > 36) recommendations.push("Reduce monthly debt obligations before applying, or consider a longer loan term.");
  if (lti > 4) recommendations.push("Request a smaller loan amount relative to your income to improve your profile.");
  if (form.employmentType === "unemployed") recommendations.push("Secure employment before applying — lenders require proof of income.");
  if (employed < 12 && form.employmentType !== "retired") recommendations.push("6–12+ months of tenure with your current employer strengthens your application.");
  if (recommendations.length === 0 && approvalProbability >= 70) recommendations.push("Your profile is strong. Compare rates from multiple lenders to find the best terms.");
  if (recommendations.length === 0) recommendations.push("Address the fair-rated factors above before submitting a formal application.");

  return { approvalProbability, verdict, monthlyPayment: monthly, dti, riskFactors, recommendations };
}

function GaugeChart({ probability, verdict }: { probability: number; verdict: string }) {
  const color =
    verdict === "approved" ? "#34d399"
    : verdict === "conditional" ? "#f59e0b"
    : "#f87171";

  const data = [{ value: probability, fill: color }];

  return (
    <div className="relative flex flex-col items-center">
      <div className="w-56 h-36 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="85%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={14}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar
              background={{ fill: "rgba(255,255,255,0.05)" }}
              dataKey="value"
              angleAxisId={0}
              cornerRadius={7}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="font-mono text-4xl font-medium" style={{ color }}>{probability}%</span>
          <span className="text-xs text-muted-foreground mt-0.5 uppercase tracking-widest font-mono">
            approval odds
          </span>
        </div>
      </div>
    </div>
  );
}

function AnimatedBar({ score, status }: { score: number; status: string }) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(score), 50);
    return () => clearTimeout(timer);
  }, [score]);

  const color =
    status === "good" ? "#34d399"
    : status === "fair" ? "#f59e0b"
    : "#f87171";

  return (
    <div ref={ref} className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

const statusIcon = {
  good: <CheckCircle size={14} className="text-emerald-400 shrink-0" />,
  fair: <AlertTriangle size={14} className="text-amber-400 shrink-0" />,
  poor: <XCircle size={14} className="text-red-400 shrink-0" />,
};

const verdictConfig = {
  approved: {
    label: "Likely Approved",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    text: "text-emerald-400",
    icon: <CheckCircle size={18} className="text-emerald-400" />,
  },
  conditional: {
    label: "Conditional Review",
    bg: "bg-amber-400/10",
    border: "border-amber-400/20",
    text: "text-amber-400",
    icon: <AlertTriangle size={18} className="text-amber-400" />,
  },
  rejected: {
    label: "Likely Rejected",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
    text: "text-red-400",
    icon: <XCircle size={18} className="text-red-400" />,
  },
};

function InputField({
  label,
  id,
  value,
  onChange,
  placeholder,
  prefix,
  type = "text",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm">
            {prefix}
          </span>
        )}
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-md bg-secondary border border-border text-foreground text-sm font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors py-2.5 ${prefix ? "pl-7 pr-3" : "px-3"}`}
        />
      </div>
    </div>
  );
}

function SelectField<T extends string>({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full rounded-md bg-secondary border border-border text-foreground text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-colors py-2.5 px-3 appearance-none cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-card">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof FormData) => (val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  const isValid =
    parseFloat(form.annualIncome) > 0 &&
    parseInt(form.creditScore) >= 300 &&
    parseInt(form.creditScore) <= 850 &&
    parseFloat(form.loanAmount) > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    const res = predict(form);
    setResult(res);
    setSubmitted(true);
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setResult(null);
    setSubmitted(false);
  }

  const vc = result ? verdictConfig[result.verdict] : null;

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between sticky top-0 bg-background/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md bg-primary/15 border border-primary/30 flex items-center justify-center">
            <Shield size={14} className="text-primary" />
          </div>
          <span className="font-mono text-sm font-medium tracking-wide text-foreground">LoanSight</span>
          <span className="hidden sm:block text-xs font-mono text-muted-foreground/50 ml-1">/ APPROVAL PREDICTOR</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground/40 uppercase tracking-widest">v2.4.1</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Hero */}
        <div className="mb-10">
          <p className="text-xs font-mono text-primary uppercase tracking-widest mb-3">Predictive Analysis</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground leading-tight mb-3">
            Loan Approval<br />
            <span className="text-muted-foreground font-light">Intelligence Engine</span>
          </h1>
          <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
            Enter your financial profile below. Our model evaluates credit, income, debt ratio, and employment stability to estimate approval likelihood.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
          {/* Form Card */}
          <div className="bg-card border border-border rounded-xl p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Section: Income & Loan */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign size={14} className="text-primary" />
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Financials</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InputField
                    label="Annual Income"
                    id="income"
                    value={form.annualIncome}
                    onChange={set("annualIncome")}
                    placeholder="75,000"
                    prefix="$"
                    type="number"
                  />
                  <InputField
                    label="Loan Amount"
                    id="loanAmount"
                    value={form.loanAmount}
                    onChange={set("loanAmount")}
                    placeholder="25,000"
                    prefix="$"
                    type="number"
                  />
                  <InputField
                    label="Existing Monthly Debt"
                    id="debt"
                    value={form.existingDebt}
                    onChange={set("existingDebt")}
                    placeholder="500"
                    prefix="$"
                    type="number"
                  />
                  <InputField
                    label="Credit Score (300–850)"
                    id="credit"
                    value={form.creditScore}
                    onChange={set("creditScore")}
                    placeholder="720"
                    type="number"
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Section: Loan Details */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp size={14} className="text-primary" />
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Loan Details</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    label="Loan Term"
                    id="term"
                    value={form.loanTermMonths}
                    onChange={set("loanTermMonths")}
                    options={[
                      { value: "12", label: "12 months" },
                      { value: "24", label: "24 months" },
                      { value: "36", label: "36 months" },
                      { value: "48", label: "48 months" },
                      { value: "60", label: "60 months" },
                      { value: "84", label: "84 months" },
                      { value: "120", label: "120 months" },
                      { value: "180", label: "180 months" },
                      { value: "360", label: "360 months (30yr)" },
                    ]}
                  />
                  <SelectField
                    label="Loan Purpose"
                    id="purpose"
                    value={form.loanPurpose}
                    onChange={(v) => setForm((f) => ({ ...f, loanPurpose: v }))}
                    options={[
                      { value: "personal", label: "Personal" },
                      { value: "home", label: "Home Purchase" },
                      { value: "auto", label: "Auto" },
                      { value: "business", label: "Business" },
                      { value: "education", label: "Education" },
                      { value: "debt-consolidation", label: "Debt Consolidation" },
                    ]}
                  />
                </div>
              </div>

              <div className="h-px bg-border" />

              {/* Section: Employment */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase size={14} className="text-primary" />
                  <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Employment</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <SelectField
                    label="Employment Type"
                    id="empType"
                    value={form.employmentType}
                    onChange={(v) => setForm((f) => ({ ...f, employmentType: v }))}
                    options={[
                      { value: "full-time", label: "Full-time" },
                      { value: "part-time", label: "Part-time" },
                      { value: "self-employed", label: "Self-employed" },
                      { value: "retired", label: "Retired" },
                      { value: "unemployed", label: "Unemployed" },
                    ]}
                  />
                  <InputField
                    label="Months at Current Job"
                    id="tenure"
                    value={form.monthsEmployed}
                    onChange={set("monthsEmployed")}
                    placeholder="36"
                    type="number"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={!isValid}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-mono font-medium py-3 rounded-md hover:bg-primary/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.99]"
                >
                  Run Analysis
                  <ChevronRight size={16} />
                </button>
                {submitted && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-4 text-sm font-mono text-muted-foreground border border-border rounded-md hover:border-border/60 hover:text-foreground transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              {!isValid && (form.annualIncome || form.creditScore || form.loanAmount) && (
                <p className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                  <Info size={12} />
                  Fill in income, a valid credit score (300–850), and loan amount to proceed.
                </p>
              )}
            </form>
          </div>

          {/* Results Panel */}
          <div className="flex flex-col gap-4">
            {!result ? (
              <div className="bg-card border border-border border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3 min-h-[360px]">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Shield size={18} className="text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground font-mono">
                  Complete the form and run analysis to see your approval prediction.
                </p>
              </div>
            ) : (
              <>
                {/* Verdict */}
                <div className={`rounded-xl border p-5 ${vc!.bg} ${vc!.border}`}>
                  <div className="flex items-center gap-2 mb-4">
                    {vc!.icon}
                    <span className={`text-sm font-mono font-medium ${vc!.text}`}>{vc!.label}</span>
                  </div>
                  <GaugeChart probability={result.approvalProbability} verdict={result.verdict} />
                  <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Est. Monthly</p>
                      <p className="text-lg font-mono font-medium text-foreground">
                        ${result.monthlyPayment.toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">Debt-to-Income</p>
                      <p className={`text-lg font-mono font-medium ${result.dti > 43 ? "text-red-400" : result.dti > 36 ? "text-amber-400" : "text-emerald-400"}`}>
                        {result.dti.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Risk Factors */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">Risk Factors</p>
                  <div className="flex flex-col gap-4">
                    {result.riskFactors.map((f) => (
                      <div key={f.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            {statusIcon[f.status]}
                            <span className="text-xs font-mono text-foreground">{f.label}</span>
                            <span className="text-xs font-mono text-muted-foreground/40">·{f.weight}%</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">{f.score}/100</span>
                        </div>
                        <AnimatedBar score={f.score} status={f.status} />
                        <p className="text-xs font-mono text-muted-foreground mt-1.5">{f.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommendations */}
                <div className="bg-card border border-border rounded-xl p-5">
                  <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">Recommendations</p>
                  <ul className="flex flex-col gap-2.5">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex gap-2.5 text-xs font-mono text-muted-foreground leading-relaxed">
                        <span className="text-primary shrink-0 mt-0.5">→</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-xs font-mono text-muted-foreground/30 text-center leading-relaxed max-w-xl mx-auto">
          This tool provides an estimate only and does not constitute financial advice. Actual loan decisions are made by lenders based on additional factors. No data is transmitted or stored.
        </p>
      </main>
    </div>
  );
}
