import type React from "react"
import { brand } from "./theme"

/**
 * A4 landscape @96dpi: 1123 × 794.
 * Fundo creme suave; cada slide é uma "página" com break-after na impressão.
 */
export function SlideShell({
  children,
  bg = brand.sandSoft,
}: {
  children: React.ReactNode
  bg?: string
}) {
  return (
    <section
      className="slide-page"
      style={{
        width: "1123px",
        height: "794px",
        background: bg,
        color: brand.ink,
      }}
    >
      <div className="w-full h-full px-14 py-12 flex flex-col">{children}</div>
    </section>
  )
}
