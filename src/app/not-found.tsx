import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <Card className="mx-auto mt-16 max-w-lg">
      <CardHeader>
        <CardTitle>Not found</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          This story or voice doesn&apos;t exist (anymore).
        </p>
        <Button asChild variant="outline">
          <Link href="/">Back to stories</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
