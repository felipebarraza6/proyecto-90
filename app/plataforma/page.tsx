import { requireChatGPTUser } from "../chatgpt-auth";
import { getOrCreateViewer } from "../../db/access";
import { FunctionalApp } from "../functional-app";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  const auth = await requireChatGPTUser("/plataforma");
  const viewer = await getOrCreateViewer(auth);
  return <FunctionalApp initialViewer={viewer} />;
}
