import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() &&
    process.env.SUPABASE_SECRET_KEY?.trim()
  );
  const allowedEmails = (process.env.ODT_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
  const allowedDomains = (process.env.ODT_ALLOWED_EMAIL_DOMAINS || "northfly.aero")
    .split(",")
    .map((domain) => `@${domain.trim().replace(/^@/, "")}`)
    .filter((domain) => domain !== "@")
    .join(", ");
  const allowedAccounts = [...allowedEmails, allowedDomains].filter(Boolean).join(", ");

  return <LoginForm configured={configured} allowedDomains={allowedAccounts} />;
}
