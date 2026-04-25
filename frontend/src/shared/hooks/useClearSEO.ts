import { useEffect } from 'react';

export function useClearSEO() {
  useEffect(() => {
    const metaTags = [
      'description',
      'keywords',
      'author',
      'og:title',
      'og:description',
      'og:url',
      'og:image',
      'og:type',
      'twitter:title',
      'twitter:description',
      'twitter:image',
      'twitter:card',
    ];

    metaTags.forEach(tag => {
      const isProperty = tag.startsWith('og:') || tag.startsWith('twitter:');
      const selector = `meta[${isProperty ? 'property' : 'name'}="${tag}"]`;
      document.querySelector(selector)?.remove();
    });

    document.querySelector('link[rel="canonical"]')?.remove();

    document.title = 'DrinkHub';

    return () => {
    };
  }, []);
}
