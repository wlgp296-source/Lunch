const imageCache = new Map();

export async function searchNaverImages(query, display = 1) {
  const cacheKey = `${query}::${display}`;
  if (!imageCache.has(cacheKey)) {
    imageCache.set(cacheKey, fetch(`/api/naver-image-search?q=${encodeURIComponent(query)}&display=${display}`)
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '네이버 이미지 검색에 실패했습니다.');
        return data.images || [];
      })
      .catch(() => []));
  }
  return imageCache.get(cacheKey);
}

export async function searchNaverImage(query) {
  const images = await searchNaverImages(query, 1);
  return images[0] || null;
}

export async function addNaverRestaurantImages(restaurants, mealName, location) {
  return Promise.all((restaurants || []).map(async restaurant => {
    const restaurantImages = await searchNaverImages(restaurant.name, 5);
    const normalizedName = String(restaurant.name ?? '').replace(/\s+/g, '').toLowerCase();
    const image = restaurantImages.find(item => String(item.title ?? '').replace(/\s+/g, '').toLowerCase().includes(normalizedName))
      || restaurantImages[0];
    return {
      ...restaurant,
      imageUrl: image?.link || '',
      imageTitle: image?.title || '',
    };
  }));
}
