import { Resend } from "resend";
import nodemailer from "nodemailer";

export const resendTransport = new Resend(process.env.RESEND_API_KEY);

export const nodemailerTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});
