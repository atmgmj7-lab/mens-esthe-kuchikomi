import { createHash } from "node:crypto";
import sharp from "sharp";

const MAX = 5 * 1024 * 1024;
export async function inspectListingImage(file: File): Promise<{ ok: true; bytes: Uint8Array; type: "image/jpeg"; width: number; height: number; sha256: string } | { ok: false; error: string }> {
  if (file.size < 1 || file.size > MAX) return { ok: false, error: "画像は5MB以下にしてください。" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  let type: "image/png" | "image/jpeg" | "image/webp" | null = null; let width = 0; let height = 0;
  if (bytes.length >= 24 && bytes.slice(0,8).every((v,i)=>v === [137,80,78,71,13,10,26,10][i])) { type="image/png"; width=new DataView(bytes.buffer).getUint32(16); height=new DataView(bytes.buffer).getUint32(20); }
  else if (bytes[0]===255 && bytes[1]===216) { type="image/jpeg"; for(let i=2;i+9<bytes.length;){ if(bytes[i]!==255){i++;continue;} const marker=bytes[i+1]; const len=(bytes[i+2]<<8)|bytes[i+3]; if(marker>=192&&marker<=195){height=(bytes[i+5]<<8)|bytes[i+6];width=(bytes[i+7]<<8)|bytes[i+8];break;} i+=2+len; } }
  else if (bytes.length>=30 && String.fromCharCode(...bytes.slice(0,4))==="RIFF" && String.fromCharCode(...bytes.slice(8,12))==="WEBP" && String.fromCharCode(...bytes.slice(12,16))==="VP8X") { type="image/webp"; width=1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16); height=1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16); }
  if (!type || width < 1 || height < 1 || width > 4096 || height > 4096) return { ok:false,error:"PNG・JPEG・WebPの実画像（最大4096px）を選択してください。" };
  try {
    // Decode every accepted source and encode a new raster without
    // withMetadata().  This deliberately drops EXIF/XMP/ICC location and
    // device metadata instead of trusting magic bytes or client MIME types.
    const rendered = await sharp(bytes, { failOn: "error", limitInputPixels: 64_000_000 })
      .rotate().jpeg({ quality: 88, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    if (rendered.info.width < 1 || rendered.info.height < 1 || rendered.info.width > 4096 || rendered.info.height > 4096) throw new Error("bounds");
    const clean = new Uint8Array(rendered.data);
    return { ok:true,bytes:clean,type:"image/jpeg",width:rendered.info.width,height:rendered.info.height,sha256:createHash("sha256").update(clean).digest("hex") };
  } catch { return { ok:false,error:"画像を安全に読み込めませんでした。別のPNG・JPEG・WebPを選択してください。" }; }
}
