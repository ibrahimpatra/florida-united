'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ProductForm } from '@/components/admin/ProductForm';
export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`/api/products/${id}`).then(r=>r.json()).then(d=>{ setProduct(d); setLoading(false); });
  }, [id]);
  if (loading) return <div className="p-8"><div className="skeleton h-96 w-full rounded-2xl"/></div>;
  return (
    <div className="p-3 sm:p-4 lg:p-5">
      <ProductForm initialData={product} productId={id} />
    </div>
  );
}
