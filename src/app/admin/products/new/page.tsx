import { ProductForm } from '@/components/admin/ProductForm';
export const metadata = { title: 'Add Product — Admin' };
export default function NewProductPage() {
  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <ProductForm />
    </div>
  );
}
