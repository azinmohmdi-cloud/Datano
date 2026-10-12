import ProductBrand from "./brand";
import ProductNavigation from "./navigation";

export default function ProductHeader() {
  return (
    <header className="relative z-20 shrink-0 border-b bg-background">
      <div className="relative mx-auto flex min-h-22 w-full max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <ProductBrand />
        <ProductNavigation />
      </div>
    </header>
  );
}
