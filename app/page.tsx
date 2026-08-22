import { LandingPage } from "./landing-page";
import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";
export default async function Home() {
  const rows = await env.DB.prepare("SELECT key,value FROM app_settings WHERE key IN ('payment_monthly_url','payment_full_url')").all<{key:string;value:string}>();
  const settings = Object.fromEntries(rows.results.map(row => [row.key, row.value]));
  return <LandingPage monthlyPaymentUrl={settings.payment_monthly_url || ""} fullPaymentUrl={settings.payment_full_url || ""} />;
}
