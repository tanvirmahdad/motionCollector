// ---- EMAIL THE CSV USING SENDGRID ----
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (!SENDGRID_API_KEY) {
  console.error("SENDGRID_API_KEY not set");
  return { statusCode: 500, body: JSON.stringify({ ok:false, error:"SENDGRID_API_KEY not set" }) };
}
sgMail.setApiKey(SENDGRID_API_KEY);

// The participant's email is now the recipient
const TO_ADDRESS   = email;                                  // user input
const FROM_ADDRESS = "motion.collector.sender@gmail.com";    // MUST be verified in SendGrid

const subject = `Your Motion Data Submission`;
const textSummary = [
  `Hello,`,
  ``,
  `Attached is the motion sensor data you just recorded.`,
  ``,
  `Device info: ${userAgent || "N/A"}`,
  `Collected at: ${collectedAt || new Date().toISOString()}`,
  ``,
  `Best,`,
  `Sturdy Lab Motion Data Collector`
].join("\n");

const msg = {
  to: TO_ADDRESS,
  from: FROM_ADDRESS,
  subject,
  text: textSummary,
  attachments: [
    {
      content: Buffer.from(csv, "utf8").toString("base64"),
      filename: "motion_data.csv",
      type: "text/csv",
      disposition: "attachment"
    }
  ]
};

try {
  const [resp] = await sgMail.send(msg);
  console.log("SendGrid response:", resp.statusCode);
} catch (mailErr) {
  const details = mailErr?.response?.body || mailErr.message || String(mailErr);
  console.error("SendGrid error:", details);
  return { statusCode: 500, body: JSON.stringify({ ok:false, error:"SendGrid error", details }) };
}
