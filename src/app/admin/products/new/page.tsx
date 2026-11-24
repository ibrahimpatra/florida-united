import { ProductForm } from '@/components/admin/ProductForm';
export const metadata = { title: 'Add Product — Admin' };
export default function NewProductPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <ProductForm />
    </div>
  );
}
