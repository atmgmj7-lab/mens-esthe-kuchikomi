import { ListingApplicationDetail } from "@/components/dashboard/ListingApplications";

export const instant = false;
export default async function ListingApplicationPage({ params }: { params: Promise<{ id: string }> }) { return <ListingApplicationDetail id={(await params).id} />; }
