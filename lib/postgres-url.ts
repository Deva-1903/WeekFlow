const PG_SSL_WARNING_MODES = new Set(["prefer", "require", "verify-ca"]);

/**
 * pg currently treats sslmode=require as verify-full and warns that this will
 * change in a future major version. Neon URLs commonly include sslmode=require,
 * so normalize to the explicit current behavior before pg parses the URL.
 */
export function normalizePostgresUrlForPg(connectionString?: string) {
  if (!connectionString) return connectionString;

  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");

    if (sslMode && PG_SSL_WARNING_MODES.has(sslMode)) {
      url.searchParams.set("sslmode", "verify-full");
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}
