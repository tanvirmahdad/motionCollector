exports.handler = async () => {
  const hasKey = !!process.env.SENDGRID_API_KEY;
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ok: true,
      hasSendgridKey: hasKey   // should be true
    })
  };
};
