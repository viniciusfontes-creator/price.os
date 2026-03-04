import NextAuth, { type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import { getSupabaseAdmin } from "@/lib/supabase-server"

const ALLOWED_DOMAIN = "quartoavista.com.br"

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login",
    },
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60,
    },
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
        async signIn({ user, account, profile }) {
            const email = user.email || profile?.email
            if (!email) return false

            const domain = email.split("@")[1]
            if (domain !== ALLOWED_DOMAIN) {
                return "/login?error=domain"
            }

            try {
                const supabase = getSupabaseAdmin()
                if (supabase) {
                    const googleSub = account?.providerAccountId

                    await supabase
                        .from("users")
                        .upsert(
                            {
                                email: email.toLowerCase(),
                                name: user.name || null,
                                image: user.image || null,
                                google_sub: googleSub || null,
                                last_login: new Date().toISOString(),
                            },
                            { onConflict: "email" }
                        )
                }
            } catch (err) {
                console.error("[NextAuth] Supabase upsert error:", err)
            }

            return true
        },

        async jwt({ token, user, account }) {
            if (account && user) {
                token.id = user.id
                token.email = user.email
                token.name = user.name
                token.picture = user.image
                token.sub = account.providerAccountId
            }
            return token
        },

        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.sub as string
                session.user.email = token.email as string
                session.user.name = token.name as string
                session.user.image = token.picture as string
            }
            return session
        },
    },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
