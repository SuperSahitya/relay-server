import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db/db";
import { account, session, user, verification } from "../db/schema";
import { nodemailerTransport } from "../lib/mailer";
import logger from "../lib/logger";

const authLogger = logger.child({ module: "auth" });

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      verification: verification,
      account: account,
      user: user,
      session: session,
    },
  }),
  verification: {
    modelName: "verification",
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }, request) => {
      try {
        authLogger.debug(
          {
            userId: user.id,
            email: user.email,
          },
          "Sending verification email"
        );
        
        await nodemailerTransport.sendMail({
          from: "Narrator anecdote.narrator@gmail.com",
          to: user.email,
          subject: "Verify Your Email",
          html: `Click the link to verify your email: ${url}`,
          text: `Click the link to verify your email: ${url}`,
        });
      } catch (error) {
        authLogger.error(
          {
            error,
            userId: user.id,
            email: user.email,
          },
          "Failed to send verification email"
        );
        throw error;
      }
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
  trustedOrigins: ["http://localhost:3000"],
  plugins: [admin({ adminUserIds: [process.env.ADMIN_USER_ID!] })],
});
