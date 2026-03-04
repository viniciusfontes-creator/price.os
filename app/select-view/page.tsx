"use client"

import { useRouter } from "next/navigation"
import { useViewContext, VIEW_CONFIGS, type ViewType } from "@/contexts/view-context"
import { useEffect, useState } from "react"

const viewCards: { key: ViewType; emoji: string; features: string[] }[] = [
    {
        key: "overview",
        emoji: "🏢",
        features: ["Dashboard consolidado", "Pace geral", "Visão macro da operação"],
    },
    {
        key: "short-stay",
        emoji: "🏠",
        features: [
            "Todas as funcionalidades",
            "Pricing & Mercado",
            "Inteligência de Vendas",
            "Análise de Concorrentes",
        ],
    },
    {
        key: "hotelaria",
        emoji: "🏨",
        features: [
            "Dashboard & Pace",
            "Gestão de Unidades",
            "Inteligência de Vendas",
        ],
    },
]

export default function SelectViewPage() {
    const router = useRouter()
    const { setView, hasSelectedView } = useViewContext()
    const [hoveredCard, setHoveredCard] = useState<ViewType | null>(null)
    const [selectedCard, setSelectedCard] = useState<ViewType | null>(null)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // If view already selected, redirect to dashboard
    useEffect(() => {
        if (hasSelectedView && mounted) {
            router.replace("/")
        }
    }, [hasSelectedView, mounted, router])

    const handleSelect = (view: ViewType) => {
        setSelectedCard(view)
        setTimeout(() => {
            setView(view)
            router.push("/")
        }, 400)
    }

    if (!mounted) return null

    return (
        <div className="select-view-container">
            {/* Background with animated gradient mesh */}
            <div className="select-view-bg">
                <div className="select-view-mesh mesh-1" />
                <div className="select-view-mesh mesh-2" />
                <div className="select-view-mesh mesh-3" />
            </div>

            <div className="select-view-content">
                {/* Logo area */}
                <div className="select-view-header">
                    <img
                        src="https://cdn.prod.website-files.com/63977cb1ecc6e0c28d964384/63977e3b4b25e34b04d3e541_QUARTO%20A%20VISTA%20PRINCIPAL.png"
                        alt="QAVI"
                        className="select-view-logo"
                    />
                    <h1 className="select-view-title">Selecione o contexto</h1>
                    <p className="select-view-subtitle">
                        Escolha a visão que melhor se aplica ao seu trabalho hoje
                    </p>
                </div>

                {/* Cards */}
                <div className="select-view-cards">
                    {viewCards.map((card, index) => {
                        const config = VIEW_CONFIGS[card.key]
                        const isHovered = hoveredCard === card.key
                        const isSelected = selectedCard === card.key
                        const isOtherSelected = selectedCard !== null && selectedCard !== card.key

                        return (
                            <button
                                key={card.key}
                                className={`select-view-card ${isHovered ? "hovered" : ""} ${isSelected ? "selected" : ""} ${isOtherSelected ? "dimmed" : ""}`}
                                style={{
                                    "--card-color": config.color,
                                    "--card-index": index,
                                    animationDelay: `${index * 120}ms`,
                                } as React.CSSProperties}
                                onMouseEnter={() => setHoveredCard(card.key)}
                                onMouseLeave={() => setHoveredCard(null)}
                                onClick={() => handleSelect(card.key)}
                            >
                                {/* Glow effect */}
                                <div className="select-view-card-glow" />

                                {/* Card content */}
                                <div className="select-view-card-inner">
                                    <span className="select-view-card-emoji">{card.emoji}</span>
                                    <h2 className="select-view-card-title">{config.label}</h2>
                                    <p className="select-view-card-description">{config.description}</p>

                                    <div className="select-view-card-divider" />

                                    <ul className="select-view-card-features">
                                        {card.features.map((feature) => (
                                            <li key={feature}>
                                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="select-view-card-cta">
                                        Acessar →
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>

            <style jsx>{`
                .select-view-container {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f5f5f7;
                    overflow: hidden;
                    z-index: 100;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                .select-view-bg {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    pointer-events: none;
                }

                .select-view-mesh {
                    position: absolute;
                    border-radius: 50%;
                    filter: blur(120px);
                    opacity: 0.15;
                    animation: meshFloat 20s ease-in-out infinite;
                }

                .mesh-1 {
                    width: 600px;
                    height: 600px;
                    background: #4f46e5;
                    top: -200px;
                    left: -100px;
                    animation-delay: 0s;
                }

                .mesh-2 {
                    width: 500px;
                    height: 500px;
                    background: #0ea5e9;
                    bottom: -150px;
                    right: -100px;
                    animation-delay: -7s;
                }

                .mesh-3 {
                    width: 400px;
                    height: 400px;
                    background: #3b82f6;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    animation-delay: -14s;
                }

                @keyframes meshFloat {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(30px, -30px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.95); }
                }

                .select-view-content {
                    position: relative;
                    z-index: 1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 48px;
                    padding: 32px;
                    max-width: 1200px;
                    width: 100%;
                }

                .select-view-header {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                    animation: fadeIn 0.6s ease-out;
                }

                .select-view-logo {
                    height: 48px;
                    width: auto;
                    object-fit: contain;
                    margin-bottom: 8px;
                    filter: brightness(0);
                }

                .select-view-title {
                    font-size: 36px;
                    font-weight: 700;
                    color: #1d1d1f;
                    letter-spacing: -0.02em;
                    margin: 0;
                }

                .select-view-subtitle {
                    font-size: 17px;
                    color: #86868b;
                    margin: 0;
                    font-weight: 500;
                }

                .select-view-cards {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 24px;
                    width: 100%;
                }

                @media (max-width: 900px) {
                    .select-view-cards {
                        grid-template-columns: 1fr;
                        max-width: 400px;
                    }
                }

                .select-view-card {
                    position: relative;
                    background: #ffffff;
                    border: 1px solid rgba(0, 0, 0, 0.04);
                    border-radius: 20px;
                    padding: 0;
                    cursor: pointer;
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    animation: cardSlideUp 0.6s ease-out backwards;
                    overflow: hidden;
                    text-align: left;
                    color: #1d1d1f;
                    font-family: inherit;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
                }

                @keyframes cardSlideUp {
                    from {
                        opacity: 0;
                        transform: translateY(40px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .select-view-card:hover {
                    transform: translateY(-4px) scale(1.01);
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
                }

                .select-view-card.selected {
                    border-color: var(--card-color);
                    transform: scale(1.02);
                    box-shadow: 0 0 0 2px var(--card-color), 0 12px 40px rgba(0, 0, 0, 0.1);
                }

                .select-view-card.dimmed {
                    opacity: 0.4;
                    transform: scale(0.96);
                    pointer-events: none;
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.02);
                }

                .select-view-card-glow {
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at 50% 0%, var(--card-color), transparent 70%);
                    opacity: 0;
                    transition: opacity 0.4s;
                }

                .select-view-card:hover .select-view-card-glow {
                    opacity: 0.04;
                }

                .select-view-card.selected .select-view-card-glow {
                    opacity: 0.08;
                }

                .select-view-card-inner {
                    position: relative;
                    z-index: 1;
                    padding: 36px 28px 28px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .select-view-card-emoji {
                    font-size: 48px;
                    line-height: 1;
                    margin-bottom: 4px;
                }

                .select-view-card-title {
                    font-size: 22px;
                    font-weight: 700;
                    margin: 0;
                    letter-spacing: -0.01em;
                }

                .select-view-card-description {
                    font-size: 14px;
                    color: #86868b;
                    margin: 0;
                    line-height: 1.5;
                }

                .select-view-card-divider {
                    width: 40px;
                    height: 2px;
                    background: var(--card-color);
                    opacity: 0.8;
                    margin: 4px 0;
                    border-radius: 1px;
                }

                .select-view-card-features {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .select-view-card-features li {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                    color: #515154;
                    font-weight: 500;
                }

                .select-view-card-features li svg {
                    color: var(--card-color);
                    flex-shrink: 0;
                }

                .select-view-card-cta {
                    margin-top: 16px;
                    font-size: 15px;
                    font-weight: 600;
                    color: var(--card-color);
                    opacity: 0;
                    transform: translateX(-8px);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .select-view-card:hover .select-view-card-cta {
                    opacity: 1;
                    transform: translateX(0);
                }
            `}</style>
        </div>
    )
}
