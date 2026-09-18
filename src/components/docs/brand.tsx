import Image from 'next/image';
export function Brand() {
  return (
    <span className="turnfin-brand">
      <span className="turnfin-fin" aria-hidden="true">
        <Image src="/brand/turnfin.png" alt="" width={88} height={88} priority />
      </span>
      <span className="brand-wordmark">
        Turnfin <span>Docs</span>
      </span>
    </span>
  );
}
