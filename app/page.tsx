import { getChatGPTUser } from "./chatgpt-auth";
import { getOrCreateViewer } from "../db/access";
import { FunctionalApp } from "./functional-app";
import { Landing } from "./landing";
import { getBootstrap } from "../db/queries";

export const dynamic = "force-dynamic";

export default async function Home() {
  const auth = await getChatGPTUser();
  if (!auth) return <Landing />;
  const viewer = await getOrCreateViewer(auth);
  const initialData = await getBootstrap(viewer);
  return <FunctionalApp initialViewer={viewer} initialData={initialData} />;
}
