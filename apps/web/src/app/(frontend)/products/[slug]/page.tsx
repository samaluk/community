import Image from 'next/image'

import { MetaPills, PayloadDocDetail, RichContent, type SlugPageProps } from '@/components/page'
import { payloadDocRoute } from '@/lib/payloadBySlug'
import type { Product } from '@/payload-types'

const { generateMetadata, generateStaticParams } = payloadDocRoute('products', 'Products')
export { generateMetadata, generateStaticParams }

export default function ProductDetailPage({ params }: SlugPageProps) {
  return (
    <PayloadDocDetail
      backHref="/products"
      backLabel="Back to products"
      backTestId="product-detail-back-link"
      collection="products"
      kicker="Product"
      params={params}
      titleTestId="product-detail-title"
    >
      {(product) => <ProductDetailBody product={product} />}
    </PayloadDocDetail>
  )
}

// Module scope: constructing an Intl formatter loads locale data, so build
// the CLP currency formatter once instead of per render.
const clpFormatter = new Intl.NumberFormat('es-CL', {
  currency: 'CLP',
  maximumFractionDigits: 0,
  style: 'currency',
})

const formatPrice = (value: number) => clpFormatter.format(value)

function ProductDetailBody({ product }: { product: Product }) {
  return (
    <>
      <MetaPills
        items={[
          formatPrice(product.priceCLP),
          product.stockStatus === 'available' ? 'Available' : 'Unavailable',
        ]}
      />
      {product.imageUrl ? (
        // imageUrl is staff-entered and can point at arbitrary external
        // hosts, so the optimizer is skipped (unoptimized) — next/image
        // still contributes explicit dimensions, lazy loading, and layout
        // stability. Intrinsic size matches the 5:3 display aspect.
        <Image
          alt=""
          className="aspect-5/3 h-auto w-product-image rounded-lg object-cover max-[760px]:aspect-video"
          height={600}
          src={product.imageUrl}
          unoptimized
          width={1000}
        />
      ) : null}
      <RichContent body={product.body} />
    </>
  )
}
