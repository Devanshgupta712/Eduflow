import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        async signIn({ user, account, profile }: any) {
            if (account?.provider === "google") {
                try {
                    const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://lms-api-bkuw.onrender.com') + '/api/auth/google', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: user.email, name: user.name, image: user.image }),
                    });

                    if (res.ok) {
                        const data = await res.json()
                        user.access_token = data.access_token
                        user.api_user = data.user
                        return true
                    } else {
                        return false
                    }
                } catch (e) {
                    return false
                }
            }
            return true;
        },
        async jwt({ token, user }: any) {
            if (user) {
                token.api_token = user.access_token
                token.api_user = user.api_user
            }
            return token
        },
        async session({ session, token }: any) {
            if (session.user) {
                (session as any).api_token = token.api_token
                (session as any).api_user = token.api_user
            }
            return session
        }
    },
    secret: process.env.NEXTAUTH_SECRET,
})
