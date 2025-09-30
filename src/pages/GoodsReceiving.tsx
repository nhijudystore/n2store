import { Package } from "lucide-react";
import { GoodsReceivingStats } from "@/components/goods-receiving/GoodsReceivingStats";
import { GoodsReceivingList } from "@/components/goods-receiving/GoodsReceivingList";

export default function GoodsReceiving() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Kiểm hàng & nhận hàng</h1>
            <p className="text-muted-foreground">Quản lý kiểm tra và nhận hàng từ nhà cung cấp</p>
          </div>
        </div>
      </div>

      <GoodsReceivingStats />
      <GoodsReceivingList />
    </div>
  );
}
