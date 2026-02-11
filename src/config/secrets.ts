import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

let secretsCache: Record<string, string> | null = null;

export async function getDatabaseSecrets(): Promise<Record<string, string>> {
  // Return cached if already loaded
  if (secretsCache) {
    return secretsCache;
  }

  const NODE_ENV = process.env.NODE_ENV || "development";

  // LOCAL DEVELOPMENT: Return empty (use existing .env files)
  if (NODE_ENV !== "production") {
    console.log("✓ Development mode - using .env files");
    secretsCache = {};
    return secretsCache;
  }

  // PRODUCTION: Fetch database credentials from AWS Secrets Manager
  const secretName = process.env.AWS_SECRET_NAME || `breederhq-api/${ NODE_ENV }`;
  const region = process.env.AWS_REGION || "us-east-2";

  const client = new SecretsManagerClient({
    region,
    // Uses AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY from Render env vars
  });

  try {
    console.log(`Fetching database secrets from AWS Secrets Manager: ${secretName}`);

    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );

    if (!response.SecretString) {
      throw new Error("Secret value is empty");
    }

    secretsCache = JSON.parse(response.SecretString) as Record<string, string>;

    console.log("✓ Database secrets loaded from AWS Secrets Manager");
    return secretsCache;

  } catch (error) {
    console.error("❌ Failed to load database secrets from AWS Secrets Manager:", error);

    // Emergency fallback: use DATABASE_URL from env vars if present
    if (process.env.EMERGENCY_MODE === "true" && process.env.DATABASE_URL) {
      console.warn("⚠️  EMERGENCY MODE: Using DATABASE_URL from environment variables");
      secretsCache = {
        DATABASE_URL: process.env.DATABASE_URL,
        DATABASE_DIRECT_URL: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL
      };
      return secretsCache;
    }

    throw new Error("Database secret initialization failed - cannot start application");
  }
}
