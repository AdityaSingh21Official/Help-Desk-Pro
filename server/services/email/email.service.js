import Mailgen from "mailgen";
import nodemailer from "nodemailer";
import { config } from "dotenv";

config();

const mailGenerator = new Mailgen({
  theme: "default",
  product: {
    name: "HELP - DESK - PRO",
    link: "https://help.desk.pro/from/Aditya.singh",
  },
});

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

async function sendNewEmail(emailType, data) {
  let emailContent;

  switch (emailType) {
    case "newUserVerificationEmail": {
      emailContent = {
        body: {
          name: data.userName,
          intro: `"Thank you for registering! Please use the verification code below to complete your sign-up.",`,
          dictionary: {
            "Verification Code": `<strong>${data.verificationCode}</strong>`,
            "Expires In": "10 minutes",
          },
          outro:
            "If you did not register, please do not share this code with anyone. You can safely ignore this email.",
        },
      };
      break;
    }
    case "passwordResetEmail": {
      emailContent = {
        body: {},
      };
      break;
    }
    case "ticketCreationEmail": {
      emailContent = {
        body: {},
      };
      break;
    }
    case "tickedResolvedEmail": {
      emailContent = {
        body: {},
      };
      break;
    }
    default: {
      console.error(
        `Services Error : Email Service Error {sendNewEmail}\nInvalid Email Type : ${emailType}`,
      );
      return;
    }
  }

  const htmlFormatEmail = mailGenerator.generate(emailContent);
  const textFormatEmail = mailGenerator.generate(emailContent);

  await transporter.sendMail({
    from: "help.desk.supportTeam@aditya.singh",
    to: data.customerEmail,
    subject: data.subject,
    html: htmlFormatEmail,
    text: textFormatEmail,
  });
}

export { sendNewEmail };
