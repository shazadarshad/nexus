/** The Nexus mark: ink tile, geometric N, one blue focus dot. Mirrors public/favicon.svg. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="logo-mark">
      <rect width="64" height="64" rx="15" fill="#1d1d1f" />
      <path d="M22 45V24l20 21V24" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="42" cy="14.6" r="3.3" fill="#2997ff" />
    </svg>
  );
}
