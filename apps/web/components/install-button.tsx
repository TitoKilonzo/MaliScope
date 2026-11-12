'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export default function InstallButton({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<DeferredPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as DeferredPrompt); };
    const onInstalled = () => { setInstalled(true); setPromptEvent(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (installed) return <span className="text-xs font-semibold text-indigo-700">App installed</span>;
  if (!promptEvent) return <button type="button" className={compact ? 'sidebar-link w-full' : 'btn-secondary'} onClick={() => alert('To install MaliScope, use your browser menu and choose “Install app” or “Add to Home Screen”.') }><Download size={15}/>{compact ? 'Install app' : 'Install app'}</button>;
  return <button type="button" className={compact ? 'sidebar-link w-full' : 'btn-secondary'} onClick={async () => { await promptEvent.prompt(); const choice = await promptEvent.userChoice; if (choice.outcome === 'accepted') setInstalled(true); setPromptEvent(null); }}><Download size={15}/>{compact ? 'Install app' : 'Install app'}</button>;
}
