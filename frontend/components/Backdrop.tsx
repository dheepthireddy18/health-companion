/** Soft, slowly drifting colour blobs behind the content. Decorative only. */
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] animate-blob rounded-full bg-brand-200/40 blur-3xl" />
      <div className="absolute -right-24 top-40 h-[24rem] w-[24rem] animate-blob rounded-full bg-violet-200/35 blur-3xl [animation-delay:-6s]" />
      <div className="absolute bottom-0 left-1/3 h-[22rem] w-[22rem] animate-blob rounded-full bg-sky-200/30 blur-3xl [animation-delay:-12s]" />
    </div>
  );
}
