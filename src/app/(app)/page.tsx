import { redirect } from "next/navigation";

// ホームはイベント選択(/select-event)、アプリ内の入口はレジ。
export default function IndexPage() {
  redirect("/register");
}
