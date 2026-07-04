'use client';

import { useState, useEffect } from 'react';

let toastQueue: any[] = [];
let setToastsGlobal: any = null;

export function showToast(message: string, type: 'success' | 'error' = 'success') {
  const id = Date.now();
  const toast = { id, message, type };
  
  if (setToastsGlobal) {
    setToastsGlobal((prev: any) => [...prev, toast]);
    setTimeout(() => {
      if (setToastsGlobal) {
        setToastsGlobal((prev: any) => prev.filter((t: any) => t.id !== id));
      }
    }, 3000);
  } else {
    toastQueue.push(toast);
  }
}

showToast.success = (message: string, opts?: any) => showToast(message, 'success');
showToast.error = (message: string, opts?: any) => showToast(message, 'error');
showToast.info = (message: string, opts?: any) => showToast(message, 'success');
showToast.warning = (message: string, opts?: any) => showToast(message, 'error');

export { showToast as toast };

export default function ToastContainer() {
  const [toasts, setToasts] = useState<any[]>([]);

  useEffect(() => {
    setToastsGlobal = setToasts;
    // Flush any queued toasts
    if (toastQueue.length > 0) {
      setToasts(toastQueue);
      toastQueue = [];
    }
    return () => { setToastsGlobal = null; };
  }, []);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-6 py-3 rounded-2xl shadow-lg text-white text-sm font-medium ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
