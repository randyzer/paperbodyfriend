'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  }
}

const CRISP_SCRIPT_ID = 'crisp-chat-script';

export default function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID;
    if (!websiteId) {
      return;
    }

    window.$crisp = window.$crisp ?? [];
    window.CRISP_WEBSITE_ID = websiteId;

    let script = document.getElementById(CRISP_SCRIPT_ID) as HTMLScriptElement | null;
    const shouldAppendScript = !script;

    if (!script) {
      script = document.createElement('script');
      script.id = CRISP_SCRIPT_ID;
      script.src = 'https://client.crisp.chat/l.js';
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      if (shouldAppendScript && script?.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  return null;
}
