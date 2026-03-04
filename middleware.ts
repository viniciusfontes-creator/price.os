import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

export default withAuth(
    async function middleware(req) {
        const { pathname } = req.nextUrl

        // Skip onboarding check for these paths
        if (
            pathname.startsWith("/login") ||
            pathname.startsWith("/api/") ||
            pathname.startsWith("/onboarding")
        ) {
            return NextResponse.next()
        }

        // Check onboarding status via cookie (set after first check)
        const onboardingDone = req.cookies.get("onboarding_completed")?.value

        if (onboardingDone === "true") {
            return NextResponse.next()
        }

        // If no cookie, check with API
        try {
            const statusUrl = new URL("/api/auth/onboarding/status", req.url)
            const res = await fetch(statusUrl, {
                headers: { cookie: req.headers.get("cookie") || "" },
            })

            if (res.ok) {
                const data = await res.json()
                if (!data.onboarding_completed) {
                    return NextResponse.redirect(new URL("/onboarding", req.url))
                }

                // Set cookie to avoid checking every request
                const response = NextResponse.next()
                response.cookies.set("onboarding_completed", "true", {
                    maxAge: 60 * 60 * 24, // 24h
                    httpOnly: true,
                })
                return response
            }
        } catch {
            // If check fails, let them through
        }

        return NextResponse.next()
    },
    {
        pages: {
            signIn: "/login",
        },
    }
)

export const config = {
    matcher: [
        // Apply auth to all routes except login, onboarding, API routes, and static assets
        "/((?!login|onboarding|api|_next/static|_next/image|favicon.ico).*)",
    ],
}
