import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';

const r2EnvSchema = z.object({
  R2_ENDPOINT: z.string().min(1, 'R2_ENDPOINT is required'),
  R2_ACCESS_KEY_ID: z.string().min(1, 'R2_ACCESS_KEY_ID is required'),
  R2_SECRET_ACCESS_KEY: z.string().min(1, 'R2_SECRET_ACCESS_KEY is required'),
  R2_BUCKET_NAME: z.string().min(1, 'R2_BUCKET_NAME is required'),
  R2_PUBLIC_URL: z.string().min(1, 'R2_PUBLIC_URL is required'),
});

let cachedClient: S3Client | null = null;
let cachedPublicUrl: string | null = null;

function getR2Config() {
  const env = r2EnvSchema.parse(process.env);
  cachedPublicUrl = env.R2_PUBLIC_URL.replace(/\/+$/, '');
  return env;
}

function getR2Client() {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getR2Config();
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: config.R2_ENDPOINT,
    credentials: {
      accessKeyId: config.R2_ACCESS_KEY_ID,
      secretAccessKey: config.R2_SECRET_ACCESS_KEY,
    },
  });

  return cachedClient;
}

export async function uploadUserAvatarToR2(input: {
  userId: string;
  fileBuffer: Buffer;
  contentType: string;
  extension: string;
}) {
  const config = getR2Config();
  const client = getR2Client();
  const objectKey = `avatars/${input.userId}/${Date.now()}-${crypto.randomUUID()}.${input.extension}`;

  await client.send(
    new PutObjectCommand({
      Bucket: config.R2_BUCKET_NAME,
      Key: objectKey,
      Body: input.fileBuffer,
      ContentType: input.contentType,
    }),
  );

  return `${cachedPublicUrl}/${objectKey}`;
}
