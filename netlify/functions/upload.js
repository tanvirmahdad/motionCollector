// netlify/functions/upload.js
const https = require("https");

async function sendViaSendGrid(apiKey, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);

    const options = {
      hostname: "api.sendgrid.com",
      path: "/v3/mail/send",
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body });
        } else {
          reject(
            new Error(
              `SendGrid error ${res.statusCode}: ${body || "(no body)"}`
            )
          );
        }
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

exports.handler = async function (event, context) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");
    const { email, csv, userAgent, collectedAt } = data;

    if (!email || !csv) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Missing email or csv" })
      };
    }

    // --- Log submission info ---
    console.log("New submission:");
    console.log("Email:", email);
    console.log("UserAgent:", userAgent);
    console.log("CollectedAt:", collectedAt);
    console.log("CSV lines:", csv.split("\n").length);

    // --- Optional: save to Netlify Blobs (non-fatal if missing) ---
    try {
      if (
        context &&
        context.blobs &&
        typeof context.blobs.set === "function"
      ) {
        const safeEmail = email.replace(/[^a-zA-Z0-9_.-]/g, "_");
        const ts = (collectedAt || new Date().toISOString()).replace(
          /[:.]/g,
          "-"
        );
        const key = `motion_${safeEmail}_${ts}.csv`;

        await context.blobs.set(key, csv, {
          contentType: "text/csv"
        });

        console.log("Saved blob at key:", key);
      } else {
        console.log("Blobs API not available in this context.");
      }
    } catch (blobErr) {
      console.log("Blob save error (non-fatal):", blobErr);
    }

    // --- Send email via SendGrid HTTP API ---
    const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
    if (!SENDGRID_API_KEY) {
      console.error("SENDGRID_API_KEY not set");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "SENDGRID_API_KEY not set"
        })
      };
    }

    // IMPORTANT:
    // FROM_ADDRESS must be a verified Sender Identity in SendGrid
    const FROM_ADDRESS = "motion.collector.sender@gmail.com"; // change if you verified a different sender
    const TO_ADDRESS = email; // send to the email typed on the page
    const CC_PI = ""; // e.g., "your.name@ohio.edu" or "" to disable

    const subject = "Your Motion Data Submission";
    const textSummary = [
      "Hello,",
      "",
      "Attached is the motion sensor data you just recorded.",
      "",
      `Device info: ${userAgent || "N/A"}`,
      `Collected at: ${collectedAt || new Date().toISOString()}`,
      "",
      "Best,",
      "Sturdy Lab Motion Data Collector"
    ].join("\n");

    const attachmentBase64 = Buffer.from(csv, "utf8").toString("base64");

    const payload = {
      personalizations: [
        {
          to: [{ email: TO_ADDRESS }],
          ...(CC_PI ? { cc: [{ email: CC_PI }] } : {})
        }
      ],
      from: { email: FROM_ADDRESS },
      subject,
      content: [
        {
          type: "text/plain",
          value: textSummary
        }
      ],
      attachments: [
        {
          content: attachmentBase64,
          filename: "motion_data.csv",
          type: "text/csv",
          disposition: "attachment"
        }
      ]
    };

    try {
      const result = await sendViaSendGrid(SENDGRID_API_KEY, payload);
      console.log("SendGrid API success:", result.statusCode);
    } catch (mailErr) {
      console.error("SendGrid send error:", mailErr);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "SendGrid API error",
          details: String(mailErr)
        })
      };
    }

    // If we reach here, email was sent
    console.log("Email sent to participant:", TO_ADDRESS);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true })
    };
  } catch (err) {
    console.error("Upload error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: "Server error",
        details: String(err)
      })
    };
  }
};
