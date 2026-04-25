import { useEffect } from 'react';

export function SEOStructuredData() {
  useEffect(() => {
    document.title = 'DrinkHub - Multiplayer Party Games for Game Nights';

    const setMeta = (name: string, content: string, isProperty = false) => {
      let meta = document.querySelector(`meta[${isProperty ? 'property' : 'name'}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(isProperty ? 'property' : 'name', name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };

    setMeta('description', 'Play multiplayer party games online. DrinkHub features SipIt Or DipIt with 100+ cards. Perfect for game nights, pregames, and hangouts.');
    setMeta('keywords', 'party games, multiplayer games, card games, drinking games, game night, online games');
    setMeta('author', 'PixlGalaxy');

    // Open Graph
    setMeta('og:type', 'website', true);
    setMeta('og:title', 'DrinkHub - Multiplayer Party Games', true);
    setMeta('og:description', 'Play multiplayer party games online with SipIt Or DipIt and more. Perfect for game nights and hangouts.', true);
    setMeta('og:url', 'https://drinkhub.net', true);
    setMeta('og:image', 'https://drinkhub.net/og-image.svg', true);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', 'DrinkHub - Multiplayer Party Games');
    setMeta('twitter:description', 'Play multiplayer party games online. SipIt Or DipIt with 100+ cards.');
    setMeta('twitter:image', 'https://drinkhub.net/og-image.svg');

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link') as HTMLLinkElement;
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = 'https://drinkhub.net';
  }, []);

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "DrinkHub",
    "url": "https://drinkhub.net",
    "description": "Multiplayer party games for game nights and hangouts",
    "logo": "https://drinkhub.net/favicon.svg",
    "sameAs": [
      "https://github.com/PixlGalaxy/DrinkHub"
    ],
    "creator": {
      "@type": "Person",
      "name": "PixlGalaxy",
      "url": "https://github.com/PixlGalaxy"
    }
  };

  const gameSchema = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "SipIt Or DipIt",
    "description": "A multiplayer party card game with 100+ cards including challenges, truths, rules, and penalties",
    "url": "https://drinkhub.net/sipit-or-dipit",
    "gameReleaseDate": "2024",
    "numberPlayers": {
      "@type": "QuantitativeValue",
      "minValue": 2,
      "maxValue": 10
    },
    "applicationCategory": "Game",
    "operatingSystem": "Web"
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "DrinkHub",
    "url": "https://drinkhub.net",
    "description": "Multiplayer party games platform",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://drinkhub.net?search={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(gameSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
