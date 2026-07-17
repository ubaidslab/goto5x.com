import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { fetchStorefrontProduct } from "../../../../lib/storefront-api";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { productId: string } }) {
  const host = headers().get("host") ?? "";
  const product = await fetchStorefrontProduct(host, params.productId);
  if (!product) return {};
  return { title: product.seoTitle, description: product.seoDescription ?? undefined };
}

export default async function StorefrontProductPage({ params }: { params: { productId: string } }) {
  const host = headers().get("host") ?? "";
  const product = await fetchStorefrontProduct(host, params.productId);
  if (!product) notFound();

  return (
    <main style={{ padding: 24 }}>
      <a href="/">&larr; Back to store</a>
      <h1>{product.title}</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {product.media.map((asset) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={asset.id} src={asset.url} alt={product.title} style={{ maxWidth: 320 }} />
        ))}
      </div>
      {product.description && <p>{product.description}</p>}
      <h2>Options</h2>
      <ul>
        {product.variants.map((variant) => (
          <li key={variant.id}>
            {variant.sku} — {variant.price} ({variant.stockQuantity} in stock)
          </li>
        ))}
      </ul>
      <p>
        Rating: {product.averageRating} ({product.reviewCount} reviews)
      </p>
    </main>
  );
}
