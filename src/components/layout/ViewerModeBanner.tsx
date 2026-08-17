import { logout } from "@/app/(app)/logout/actions";
import { Eye } from "lucide-react";

export function ViewerModeBanner() {
  return (
    <div className="flex items-center justify-between gap-3 bg-accent-weak px-4 py-2 text-sm text-accent md:px-8">
      <div className="flex items-center gap-2">
        <Eye size={16} />
        <span className="font-medium">閲覧モードで表示しています(登録・変更・削除などの操作はできません)</span>
      </div>
      <form action={logout} className="shrink-0">
        <button type="submit" className="whitespace-nowrap underline hover:opacity-80">
          ログインする
        </button>
      </form>
    </div>
  );
}
