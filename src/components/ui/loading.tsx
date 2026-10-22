type LoadingShape = "card" | "row" | "page";

/** Décor sans donnée privée ; le lecteur d’écran reçoit une seule annonce. */
export function LoadingPlaceholder({ label = "Un petit instant…", shape = "card" }: { label?: string; shape?: LoadingShape }) {
  return <section className={`loading-placeholder loading-${shape}`} role="status" aria-busy="true" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="loading-art" aria-hidden="true">
      {shape === "page" && <div className="loading-title skeleton" />}
      <div className="loading-lines"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
      {shape !== "row" && <div className="loading-action skeleton" />}
    </div>
  </section>;
}
