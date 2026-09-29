import { useState } from 'react';
import { usePwa, promptInstall } from '../lib/pwa';
import { Modal } from './ui';
import { Icon } from './Icon';

/** Shows "Install app" when the browser supports it, or Add-to-Home-Screen steps on iOS. */
export function InstallButton({ className = 'btn sm', label = 'Install app' }: { className?: string; label?: string }) {
  const { canInstall, installed, isIOS } = usePwa();
  const [iosHelp, setIosHelp] = useState(false);
  if (installed || (!canInstall && !isIOS)) return null;
  return (
    <>
      <button className={className} onClick={() => (canInstall ? promptInstall() : setIosHelp(true))}>
        <Icon name="download" size={14} /> {label}
      </button>
      <Modal open={iosHelp} onClose={() => setIosHelp(false)} title="Add Nexus to your Home Screen" width={400}>
        <ol className="install-steps">
          <li>
            Tap the <strong>Share</strong> button in Safari’s toolbar.
          </li>
          <li>
            Scroll and choose <strong>Add to Home Screen</strong>.
          </li>
          <li>
            Tap <strong>Add</strong>. Nexus opens full-screen and works offline.
          </li>
        </ol>
      </Modal>
    </>
  );
}

export function InstallStatus() {
  const { installed, offlineReady, canInstall, isIOS } = usePwa();
  if (installed) return <span className="small muted">Installed on this device</span>;
  if (!canInstall && !isIOS)
    return <span className="small muted">{offlineReady ? 'Available offline' : 'Open in Chrome, Edge or Safari to install'}</span>;
  return null;
}
