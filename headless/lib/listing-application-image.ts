import { createHash, randomUUID } from "node:crypto";

const MAX = 5 * 1024 * 1024;
export async function inspectListingImage(file: File): Promise<{ ok: true; bytes: Uint8Array; type: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number; sha256: string; key: string } | { ok: false; error: string }> {
  if (file.size < 1 || file.size > MAX) return { ok: false, error: "画像は5MB以下にしてください。" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let type: "image/png" | "image/jpeg" | "image/webp" | null = null; let width = 0; let height = 0;
  if (bytes.length >= 24 && bytes.slice(0,8).every((v,i)=>v === [137,80,78,71,13,10,26,10][i])) { type="image/png"; width=new DataView(bytes.buffer).getUint32(16); height=new DataView(bytes.buffer).getUint32(20); }
  else if (bytes[0]===255 && bytes[1]===216) { type="image/jpeg"; for(let i=2;i+9<bytes.length;){ if(bytes[i]!==255){i++;continue;} const marker=bytes[i+1]; const len=(bytes[i+2]<<8)|bytes[i+3]; if(marker>=192&&marker<=195){height=(bytes[i+5]<<8)|bytes[i+6];width=(bytes[i+7]<<8)|bytes[i+8];break;} i+=2+len; } }
  else if (bytes.length>=30 && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP" && String.fromCharCode(...bytes.slice(12,16))==="VP8X") { type="image/webp"; width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16); height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16); }
  if (!type || width < 1 || height < 1 || width > 8000 || height > 8000) return { ok:false,error:"PNG・JPEG・WebPの実画像（最大8000px）を選択してください。" };
  const extension = type === "image/png" ? "png" : type === "image/jpeg" ? "jpg" : "webp";
  return { ok:true,bytes,type,width,height,sha256:createHash("sha256").update(bytes).digest("hex"),key:`listing-applications/${randomUUID()}/${randomUUID()}.${extension}` };
}
