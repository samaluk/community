import { MetaPills, PayloadDocDetail, RichContent, type SlugPageProps } from '@/components/page'
import { formatDifficulty } from '@/lib/articles'
import { payloadDocRoute } from '@/lib/payloadBySlug'

const { generateMetadata, generateStaticParams } = payloadDocRoute('articles', 'Articles')
export { generateMetadata, generateStaticParams }

export default function ArticleDetailPage({ params }: SlugPageProps) {
  return (
    <PayloadDocDetail
      backHref="/articles"
      backLabel="Back to articles"
      backTestId="article-detail-back-link"
      collection="articles"
      kicker="Articles"
      params={params}
      titleTestId="article-detail-title"
    >
      {(article) => (
        <>
          <MetaPills
            items={[article.category, formatDifficulty(article.difficulty)].filter(
              (item): item is string => Boolean(item),
            )}
          />
          <RichContent body={article.body} />
        </>
      )}
    </PayloadDocDetail>
  )
}
