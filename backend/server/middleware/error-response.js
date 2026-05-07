function ok(res, data, meta = {}) {
  return res.json({ success: true, data, ...meta });
}

function fail(res, code, message, status = 400, meta = {}) {
  return res.status(status).json({
    success: false,
    error: { code, message },
    ...meta
  });
}

module.exports = { ok, fail };
