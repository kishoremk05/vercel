import React from "react";
import { Helmet } from "react-helmet-async";

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
  keywords?: string;
  noindex?: boolean;
}

/**
 * SEO Component - Manages meta tags for each page
 * Includes title, description, Open Graph, Twitter Cards, and canonical URLs
 * Optimized for 95+ Lighthouse SEO score
 */
const SEO: React.FC<SEOProps> = ({
  title,
  description,
  canonical,
  ogImage = "https://reputationflow360.com/og-image.png",
  ogType = "website",
  twitterCard = "summary_large_image",
  keywords = "review automation software, customer feedback management, online reputation management, google reviews automation, sms review request system, feedback collection platform, small business review software, reputation management SaaS, automated customer surveys, review collection tool",
  noindex = false,
}) => {
  const fullTitle = title.includes("ReputationFlow360")
    ? title
    : `${title} | ReputationFlow360`;

  const canonicalUrl =
    canonical || `https://reputationflow360.com${window.location.pathname}`;

  return (
    <Helmet>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {!noindex && (
        <meta
          name="robots"
          content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1"
        />
      )}

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:site_name" content="ReputationFlow360" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={canonicalUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {/* Additional SEO */}
      <meta name="author" content="ReputationFlow360" />
      <meta name="language" content="English" />
    </Helmet>
  );
};

export default SEO;
