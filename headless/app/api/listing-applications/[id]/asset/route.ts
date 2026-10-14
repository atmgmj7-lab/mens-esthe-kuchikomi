import { NextRequest, NextResponse } from "next/server";
import { inspectListingImage } from "@/lib/listing-application-image";
import { createSupabaseServerHeaders, resolveSupabaseServerSecret } from "@/lib/supabase/server-secret";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const applicationId = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(applicationId)) return NextResponse.json({ ok:false,message:"申請を確認してください。" },{status:400});
  const form = await request.formData(); const candidate = form.get("banner");
  if (!(candidate instanceof File)) return NextResponse.json({ok:false,message:"画像を選択してください。"},{status:400});
  const image = await inspectListingImage(candidate); if (!image.ok) return NextResponse.json({ok:false,message:image.error},{status:400});
  const base=process.env.SUPABASE_URL?.replace(/\/$/,""); const secret=resolveSupabaseServerSecret(); if(!base||!secret) return NextResponse.json({ok:false,message:"現在画像を受け付けできません。"},{status:503});
  const headers=createSupabaseServerHeaders(secret.value,{"Content-Type":image.type,"x-upsert":"false"});
  const bodyBytes=image.bytes.buffer.slice(image.bytes.byteOffset,image.bytes.byteOffset+image.bytes.byteLength) as ArrayBuffer;
  const stored=await fetch(`${base}/storage/v1/object/listing-application-private/${image.key}`,{method:"POST",headers,body:new Blob([bodyBytes],{type:image.type})});
  if(!stored.ok) return NextResponse.json({ok:false,message:"画像を保存できませんでした。"},{status:503});
  const recorded=await fetch(`${base}/rest/v1/rpc/attach_listing_application_asset`,{method:"POST",headers:createSupabaseServerHeaders(secret.value,{"Content-Type":"application/json","Content-Profile":"api"}),body:JSON.stringify({p_application_id:applicationId,p_object_key:image.key,p_sha256:image.sha256,p_content_type:image.type,p_byte_size:image.bytes.length,p_width:image.width,p_height:image.height})});
  return recorded.ok ? NextResponse.json({ok:true}) : NextResponse.json({ok:false,message:"画像情報を保存できませんでした。"},{status:503});
}
