import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";

interface PutInput {
  key: string;
  body: Uint8Array;
  contentType: string;
}

export interface ObjectStore {
  put(input: PutInput): Promise<void>;
  get(key: string): Promise<Uint8Array>;
}

function safeLocalPath(root: string, key: string) {
  const resolved = normalize(join(root, key));
  if (!resolved.startsWith(normalize(root))) throw new Error("Invalid object key");
  return resolved;
}

class LocalObjectStore implements ObjectStore {
  constructor(private readonly root: string) {}
  async put(input: PutInput) {
    const path = safeLocalPath(this.root, input.key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, input.body);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(safeLocalPath(this.root, key)));
  }
}

class S3ObjectStore implements ObjectStore {
  private readonly client: S3Client;
  constructor(private readonly bucket: string) {
    this.client = new S3Client({
      region: process.env.OBJECT_STORAGE_REGION ?? "auto",
      endpoint: process.env.OBJECT_STORAGE_ENDPOINT,
      forcePathStyle: process.env.OBJECT_STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.OBJECT_STORAGE_ACCESS_KEY!,
        secretAccessKey: process.env.OBJECT_STORAGE_SECRET_KEY!
      }
    });
  }
  async put(input: PutInput) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: input.key, Body: input.body, ContentType: input.contentType }));
  }
  async get(key: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    if (!response.Body) throw new Error("Object body is empty");
    return new Uint8Array(await response.Body.transformToByteArray());
  }
}

let cached: ObjectStore | undefined;

export function objectStore() {
  if (cached) return cached;
  const bucket = process.env.OBJECT_STORAGE_BUCKET;
  if (bucket && process.env.OBJECT_STORAGE_ENDPOINT && process.env.OBJECT_STORAGE_ACCESS_KEY && process.env.OBJECT_STORAGE_SECRET_KEY) {
    cached = new S3ObjectStore(bucket);
    return cached;
  }
  if (process.env.NODE_ENV === "production") throw new Error("Production object storage is not configured");
  cached = new LocalObjectStore(join(process.cwd(), "storage"));
  return cached;
}

