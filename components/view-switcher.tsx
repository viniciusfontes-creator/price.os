"use client"

import { useRouter } from "next/navigation"
import { useViewContext, VIEW_CONFIGS, type ViewType } from "@/contexts/view-context"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, LogOut } from "lucide-react"

const viewOrder: ViewType[] = ["overview", "short-stay", "hotelaria"]

export function ViewSwitcher() {
    const { currentView, viewConfig, setView, clearView } = useViewContext()
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    if (!currentView || !viewConfig) return null

    const handleSwitch = (view: ViewType) => {
        setView(view)
        setIsOpen(false)
        // Force data re-fetch by navigating to dashboard
        router.push("/")
        router.refresh()
    }

    const handleChangeWorkspace = () => {
        clearView()
        setIsOpen(false)
        router.push("/select-view")
    }

    return (
        <div className="view-switcher" ref={dropdownRef}>
            <button
                className="view-switcher-trigger"
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                style={{ "--view-color": viewConfig.color } as React.CSSProperties}
            >
                <span className="view-switcher-indicator" />
                <span className="view-switcher-label">{viewConfig.label}</span>
                <ChevronDown
                    className={`view-switcher-chevron ${isOpen ? "open" : ""}`}
                    size={14}
                />
            </button>

            {isOpen && (
                <div className="view-switcher-dropdown">
                    <div className="view-switcher-dropdown-header">Trocar contexto</div>
                    {viewOrder.map((viewKey) => {
                        const config = VIEW_CONFIGS[viewKey]
                        const isActive = viewKey === currentView

                        return (
                            <button
                                key={viewKey}
                                className={`view-switcher-option ${isActive ? "active" : ""}`}
                                onClick={() => handleSwitch(viewKey)}
                                style={{ "--option-color": config.color } as React.CSSProperties}
                            >
                                <span className="view-switcher-option-indicator" />
                                <div className="view-switcher-option-content">
                                    <span className="view-switcher-option-label">{config.label}</span>
                                    <span className="view-switcher-option-desc">{config.description}</span>
                                </div>
                                {isActive && (
                                    <span className="view-switcher-option-badge">ativo</span>
                                )}
                            </button>
                        )
                    })}
                    <div className="view-switcher-dropdown-divider" />
                    <button className="view-switcher-option view-switcher-logout" onClick={handleChangeWorkspace}>
                        <LogOut size={14} />
                        <span>Trocar workspace</span>
                    </button>
                </div>
            )}

            <style jsx>{`
                .view-switcher {
                    position: relative;
                }

                .view-switcher-trigger {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 14px;
                    background: white;
                    border: 1px solid rgba(0,0,0,0.08);
                    border-radius: 10px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    color: #1d1d1f;
                    transition: all 0.2s ease;
                    font-family: inherit;
                }

                .view-switcher-trigger:hover {
                    background: #fafafa;
                    border-color: rgba(0,0,0,0.12);
                    box-shadow: 0 1px 4px rgba(0,0,0,0.06);
                }

                .view-switcher-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--view-color);
                    flex-shrink: 0;
                }

                .view-switcher-label {
                    white-space: nowrap;
                }

                .view-switcher-chevron {
                    transition: transform 0.2s ease;
                    opacity: 0.4;
                }

                .view-switcher-chevron.open {
                    transform: rotate(180deg);
                }

                .view-switcher-dropdown {
                    position: absolute;
                    top: calc(100% + 8px);
                    left: 0;
                    width: 280px;
                    background: white;
                    border: 1px solid rgba(0,0,0,0.08);
                    border-radius: 14px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
                    padding: 6px;
                    z-index: 9999;
                    animation: dropdownFadeIn 0.18s ease-out;
                }

                @keyframes dropdownFadeIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }

                .view-switcher-dropdown-header {
                    padding: 8px 10px 6px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: #86868b;
                }

                .view-switcher-option {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    width: 100%;
                    padding: 10px;
                    border: none;
                    background: transparent;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: background 0.15s ease;
                    font-family: inherit;
                    text-align: left;
                    color: #1d1d1f;
                }

                .view-switcher-option:hover {
                    background: #f5f5f7;
                }

                .view-switcher-option.active {
                    background: #f5f5f7;
                }

                .view-switcher-option-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--option-color);
                    flex-shrink: 0;
                }

                .view-switcher-option-content {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;
                    min-width: 0;
                }

                .view-switcher-option-label {
                    font-size: 13px;
                    font-weight: 500;
                    color: #1d1d1f;
                }

                .view-switcher-option-desc {
                    font-size: 11px;
                    color: #86868b;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .view-switcher-option-badge {
                    font-size: 10px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    color: var(--option-color);
                    background: color-mix(in srgb, var(--option-color) 10%, white);
                    padding: 2px 8px;
                    border-radius: 6px;
                }

                .view-switcher-dropdown-divider {
                    height: 1px;
                    background: rgba(0,0,0,0.06);
                    margin: 4px 8px;
                }

                .view-switcher-logout {
                    font-size: 13px;
                    color: #86868b;
                    gap: 8px;
                }

                .view-switcher-logout:hover {
                    color: #1d1d1f;
                }
            `}</style>
        </div>
    )
}
