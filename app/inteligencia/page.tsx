"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { LoadingSpinner } from "@/components/loading-spinner"

export default function RedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/pricing")
  }, [router])

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-muted-foreground animate-pulse">Este módulo foi integrado ao Pricing. Redirecionando...</p>
    </div>
  )
}
