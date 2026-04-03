export const ModalSkeleton = () => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
    <div className="relative w-full max-w-5xl modal-bg border border-white/[0.12] rounded-2xl shadow-2xl shadow-black/50 h-[85vh] animate-pulse" />
  </div>
);
