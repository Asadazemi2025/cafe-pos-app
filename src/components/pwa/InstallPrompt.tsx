"use client";

import { useEffect, useState } from "react";

// ホーム画面/デスクトップに入れて使うための下ごしらえ。
// ・Service Workerを登録する(Windows・Androidでインストールできる条件のひとつ)
// ・Chrome/Edgeが出す「インストールできます」の合図を受け取り、
//   こちらのボタンから入れられるようにする
// iPadのSafariは合図を出さないため、手順を書いた案内を出す。

type InstallEvent = Event & { prompt: () => Promise<void> };

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 登録できなくてもアプリ自体は動くので、ここでは何もしない
      });
    }

    // すでにインストール済み(単独ウィンドウで開いている)なら案内は出さない
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    try {
      if (localStorage.getItem("install-hint-dismissed") === "1") return;
    } catch {
      // localStorageが使えない環境でも案内は出す
    }
    setDismissed(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iPad/iPhoneのSafari。手順を出す
    const ua = navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (isIos) setShowIosHelp(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function close() {
    setDismissed(true);
    try {
      localStorage.setItem("install-hint-dismissed", "1");
    } catch {
      // 保存できなくても閉じられればよい
    }
  }

  if (dismissed || (!deferred && !showIosHelp)) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-[420px] rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-modal md:left-auto md:right-4 md:mx-0">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-10 w-10 shrink-0 rounded-[10px]" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold">アプリとして入れておけます</div>
          {deferred ? (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              ホーム画面やデスクトップから、ブラウザのタブを開かずに使えます。
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
              画面下(または右上)の
              <span className="mx-1 font-bold">共有ボタン</span>
              から「ホーム画面に追加」を選ぶと、アプリとして使えます。
            </p>
          )}

          <div className="mt-2.5 flex gap-2">
            {deferred && (
              <button
                onClick={async () => {
                  await deferred.prompt();
                  close();
                }}
                className="press press-cta rounded-[9px] bg-accent px-3.5 py-2 text-xs font-bold text-white"
              >
                インストール
              </button>
            )}
            <button
              onClick={close}
              className="press press-chip rounded-[9px] border border-border px-3.5 py-2 text-xs font-bold text-ink-muted"
            >
              あとで
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
