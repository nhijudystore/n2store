import { useState } from "react";
import { ActivityStats } from "@/components/activity-log/ActivityStats";
import { ActivityFilters } from "@/components/activity-log/ActivityFilters";
import { ActivityTable } from "@/components/activity-log/ActivityTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActivityLog() {
  const [filters, setFilters] = useState({});

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Lịch sử chỉnh sửa</h1>
        <p className="text-muted-foreground">
          Theo dõi tất cả các hoạt động trong hệ thống
        </p>
      </div>

      <ActivityStats />

      <Card>
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFilters onFilterChange={setFilters} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách hoạt động</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityTable filters={filters} />
        </CardContent>
      </Card>
    </div>
  );
}
