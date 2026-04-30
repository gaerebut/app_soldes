export interface ProductInfo {
  name: string | null;
  imageUrl: string | null;
}

/**
 * Réduit la résolution d'une URL image OpenFoodFacts.
 * Les URLs ont la forme : .../front_fr.400.jpg  → on remplace par .200.jpg
 */
function toSmallImageUrl(url: string): string {
  // Remplace la taille (ex: .400.jpg, .full.jpg) par .200.jpg
  return url.replace(/\.\d+\.jpg$/i, '.200.jpg').replace(/\.full\.jpg$/i, '.200.jpg');
}

export async function fetchProductByEAN(ean: string): Promise<ProductInfo | null> {
  try {
    const response = await fetch(
      `https://fr.openfoodfacts.org/api/v2/product/${encodeURIComponent(ean)}.json?fields=product_name,image_front_small_url,image_front_url`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    // Priorité : small (200px) > full réduit à 200px > null
    const rawUrl = data.product.image_front_small_url || data.product.image_front_url || null;
    const imageUrl = rawUrl ? toSmallImageUrl(rawUrl) : null;

    return {
      name: data.product.product_name || null,
      imageUrl,
    };
  } catch (error) {
    console.error('Error fetching product from Open Food Facts:', error);
    return null;
  }
}
