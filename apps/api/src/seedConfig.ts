export function getSeedAdminPassword(): string {
  const password = process.env.SEED_ADMIN_PASSWORD;
  const normalizedPassword = password?.trim().toLowerCase();

  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD must be set before running seed.");
  }

  if (!normalizedPassword || normalizedPassword === "replace_me") {
    throw new Error("SEED_ADMIN_PASSWORD must be set to a real password before running seed.");
  }

  return password;
}
