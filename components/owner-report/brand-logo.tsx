"use client"

import { brand } from "./theme"

/**
 * Logo Quarto à Vista. Lê /brand/quarto-a-vista.png e cai num wordmark
 * estilizado se o arquivo não existir ainda.
 */
export function BrandLogo({ height = 28 }: { height?: number }) {
  return (
    <div className="flex items-center gap-2" style={{ height }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- print page; next/image quebra Puppeteer */}
      <img
        src="/brand/quarto-a-vista.png"
        alt="Quarto à Vista"
        style={{ height, width: "auto", display: "block" }}
        onError={(e) => {
          ;(e.currentTarget as HTMLImageElement).style.display = "none"
          const fb = e.currentTarget.nextElementSibling as HTMLElement | null
          if (fb) fb.style.display = "inline"
        }}
      />
      <span
        style={{
          display: "none",
          fontWeight: 800,
          color: brand.primary,
          fontSize: height * 0.55,
          letterSpacing: "-0.02em",
        }}
      >
        quarto à vista
      </span>
    </div>
  )
}
