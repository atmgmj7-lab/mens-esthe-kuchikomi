import { ApprovedListingPage } from "@/components/ApprovedListingPage";
export const instant = false;
export default async function ListingPublicPage({ params }: { params: Promise<{ id: string }> }) { return <ApprovedListingPage id={(await params).id} />; }
