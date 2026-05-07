import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

const REGION = process.env.AWS_REGION ?? "us-east-1";
const PDF_BUCKET = process.env.PDF_BUCKET!;

const s3 = new S3Client({ region: REGION });

// ─── Key conventions ────────────────────────────────────────────────
//
//   raw/{jobId}.pdf            — downloaded PDF
//   text/{jobId}.txt           — extracted plain text
//   chunks/{jobId}/{n}.txt     — chunked text segments
//
// All under a single bucket; lifecycle rule deletes everything after 90 days.

export const keys = {
  pdf: (jobId: string) => `raw/${jobId}.pdf`,
  text: (jobId: string) => `text/${jobId}.txt`,
  chunk: (jobId: string, index: number) => `chunks/${jobId}/${index}.txt`,
};

export const bucket = PDF_BUCKET;

// ─── Helpers ────────────────────────────────────────────────────────

export async function putBytes(key: string, body: Uint8Array | Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: PDF_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function putText(key: string, body: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: PDF_BUCKET,
    Key: key,
    Body: body,
    ContentType: "text/plain; charset=utf-8",
  }));
}

export async function getBytes(key: string): Promise<Buffer> {
  const res = await s3.send(new GetObjectCommand({ Bucket: PDF_BUCKET, Key: key }));
  if (!res.Body) throw new Error(`empty body at s3://${PDF_BUCKET}/${key}`);
  // Stream → buffer
  const chunks: Uint8Array[] = [];
  // @ts-expect-error — Node Readable stream from S3 SDK
  for await (const chunk of res.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

export async function getText(key: string): Promise<string> {
  return (await getBytes(key)).toString("utf-8");
}

export async function listChunkKeys(jobId: string): Promise<string[]> {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: PDF_BUCKET,
    Prefix: `chunks/${jobId}/`,
  }));
  return (res.Contents ?? [])
    .map((o) => o.Key!)
    .filter(Boolean)
    .sort();
}
