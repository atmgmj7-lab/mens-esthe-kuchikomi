import { NextRequest,NextResponse } from "next/server";
import { getV11Widget } from "@/lib/supabase/eskomi-widget-v11";
export async function GET(_:NextRequest,{params}:{params:Promise<{handle:string}>}){const widget=await getV11Widget((await params).handle);return widget?NextResponse.json({ok:true,widget},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=60","X-Robots-Tag":"noindex, nofollow"}}):NextResponse.json({ok:false,code:"WIDGET_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow"}});}
