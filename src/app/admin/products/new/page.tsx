import { ProductForm } from '@/components/admin/ProductForm';
export const metadata = { title: 'Add Product — Admin' };
export default function NewProductPage() {
  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 font-display mb-8">Add New Product</h1>
      <ProductForm />
    </div>
  );
}
