import SessionChat from "@/components/manage/SessionChat";

export const dynamic = "force-dynamic";

// The console is one screen: an interactive Claude session.
export default function ManagePage() {
  return <SessionChat />;
}
